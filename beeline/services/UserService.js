import querystring from 'querystring';
import uuid from 'uuid';
import _ from 'lodash';
import verifiedPromptTemplate from '../templates/verified-prompt.html';
import requestingVerificationCodeTemplate from '../templates/requesting-verification-code.html';
import sendingVerificationCodeTemplate from '../templates/sending-verification-code.html';
import registeringWithServerTemplate from '../templates/registering-with-server.html';
const VALID_PHONE_REGEX = /^[8-9]{1}[0-9]{7}$/;
const VALID_VERIFICATION_CODE_REGEX = /^[0-9]{6}$/;
// user name must be at least 3 characters long, space in front
// or after non-space characters are ignored e.g. "   a c   ",
// "exe", "alieo" is valid name
const VALID_USER_NAME = /^\s*\S.+\S\s*$/;
// This file is dynamically generated by webpack from environment variables
const env = require('../env.json')

export default function UserService($http, $ionicPopup, $ionicLoading, $rootScope) {

  // ////////////////////////////////////////////////////////////////////////////
  // Private internal methods and variables
  // ////////////////////////////////////////////////////////////////////////////
  var sessionToken = window.localStorage.sessionToken || null;
  var user = window.localStorage.beelineUser ?
             JSON.parse(window.localStorage.beelineUser) : null;

  // General purpose wrapper for making http requests to server
  // Adds the appropriate http headers and token if signed in
  var beelineRequest = function(options) {
    options.url = env.BACKEND_URL + options.url;
    options.headers = options.headers || {};
    // Attach the session token if logged in
    if (sessionToken) {
      options.headers.authorization = 'Bearer ' + sessionToken;
    }
    // Attach headers to track execution environment
    if (window.device) {
      options.headers['Beeline-Device-UUID'] = window.device.uuid;
      options.headers['Beeline-Device-Model'] = window.device.model;
      options.headers['Beeline-Device-Platform'] = window.device.platform;
      options.headers['Beeline-Device-Version'] = window.device.version;
      options.headers['Beeline-Device-Manufacturer'] = window.device.manufacturer;
      options.headers['Beeline-Device-Serial'] = window.device.serial;
    }
    else {
      window.localStorage.uuid = window.localStorage.uuid || uuid.v4();
      options.headers['Beeline-Device-UUID'] = window.localStorage.uuid;
      options.headers['Beeline-Device-Model'] = window.navigator.userAgent;
      options.headers['Beeline-Device-Platform'] = 'Browser';
    }
    return $http(options);
  };

  // Requests a verification code to be sent to a mobile number
  // Verification code is used to log in
  var sendTelephoneVerificationCode = function(number) {
    return beelineRequest({
      method: 'POST',
      url: '/users/sendTelephoneVerification',
      data: {telephone: '+65' + number},
      headers: {'Content-Type': 'application/json'}
    }).then(function() {
      return true;
    });
  };

  // Submit the received code and number for verification to the server
  var verifyTelephone = function(telephoneNumber, code) {
    return beelineRequest({
      method: 'POST',
      url: '/users/verifyTelephone',
      data: {
        telephone: '+65' + telephoneNumber,
        code: code
      }
    })
    .then(function(response) {
      sessionToken = response.data.sessionToken;
      window.localStorage.setItem('sessionToken', sessionToken);
      user = response.data.user;
      window.localStorage.setItem('beelineUser', JSON.stringify(user));
      return user;
    });
  };

  // Prepares an update of the telephone number
  // The returned update toke is used together with the verification number
  // @returns Promise.<update token>
  var requestUpdateTelephone = function(telephone) {
    return beelineRequest({
      url: '/user/requestUpdateTelephone',
      method: 'POST',
      data: {newTelephone: '+65' + telephone}
    })
    .then(function(response) {
      return response.data.updateToken;
    });
  };

  // Really tell the server to update the telephone
  // number. Pass this function the updateToken returned by
  // requestUpdateTelephone and the verification key received
  // by SMS
  var updateTelephone = function(updateToken, verificationKey) {
    return beelineRequest({
      url: '/user/updateTelephone',
      method: 'POST',
      data: {
        code: verificationKey,
        updateToken: updateToken
      }
    })
    .then(function(reponse) {
      user = reponse.data;
      window.localStorage.setItem('beelineUser', JSON.stringify(user));
      return user;
    });
  };

  // Updates user fields
  var updateUserInfo = function(update) {
    return beelineRequest({
      method: 'PUT',
      url: '/user',
      data: update
    })
    .then(function(response) {
      user = response.data;
      return user;
    });
  };

  var logOut = function() {
    sessionToken = null;
    user = null;
    delete window.localStorage.sessionToken;
    delete window.localStorage.beelineUser;
    return Promise.resolve();
  };

  // Queries the server to test if the session is still valid
  // Updates the user info if necessary
  // If the session is invalid then log out
  var verifySession = function() {
    return beelineRequest({
      url: '/user',
      method: 'GET'
    })
    .then(function(response) {
      user = response.data;

      if (!user) {
        logOut(); // user not found
        return false;
      }

      return true;
    }, function(error) {
      if (error.status == 403 || error.status == 401) {
        logOut();
        return false;
      }
    });
  };


  // ////////////////////////////////////////////////////////////////////////////
  // UI methods
  // ////////////////////////////////////////////////////////////////////////////
  var verifiedPrompt = function(options) {
    var promptScope = $rootScope.$new(true);
    promptScope.form ={
      verifiedPromptForm : {}
    };
    promptScope.data = {};
    promptScope.data.inputs = options.inputs || [];
    _.defaultsDeep(options,{
      template: verifiedPromptTemplate,
      title: '',
      subTitle: '',
      scope: promptScope,
      buttons: [
        { text: 'Cancel'},
        {
          text: 'OK',
          onTap: function(e) {
            if (promptScope.form.verifiedPromptForm.$valid) {
              return promptScope.data;
            }
            e.preventDefault();
          }
        }
      ]
    });
    return $ionicPopup.show(options);
  };

  var promptTelephoneNumber = function(title, subtitle){
    return verifiedPrompt({
      title: title,
      subTitle: subtitle,
      inputs: [
        {
          type: 'text',
          name: 'phone',
          pattern: VALID_PHONE_REGEX
        }
      ]
    })
  }

  var promptVerificationCode = function(telephone){
    return verifiedPrompt({
      title: 'Verification',
      subTitle: 'Enter the 6-digit code sent to '+telephone,
      inputs: [
        {
          type: 'tel',
          name: 'code',
          pattern: VALID_VERIFICATION_CODE_REGEX
        }
      ]
    });
  }

  // The combined prompt for phone number and subsequent prompt for verification code
  var promptLogIn = async function() {
    try {
      var telephoneResponse = await promptTelephoneNumber('Login',
        'Please enter your 8 digit mobile number to receive a verification code.')
      if (!telephoneResponse) return;
      $ionicLoading.show({template: requestingVerificationCodeTemplate});
      var telephoneNumber = telephoneResponse.phone;
      await sendTelephoneVerificationCode(telephoneNumber);
      $ionicLoading.hide();
      var verificationCode = await promptVerificationCode(telephoneNumber);
      if (!verificationCode) return;
      $ionicLoading.show({template: sendingVerificationCodeTemplate});
      await verifyTelephone(telephoneNumber, verificationCode.code);
      $ionicLoading.hide();
    }
    // If an error occurs at any point stop and alert the user
    catch(error) {
      $ionicLoading.hide();
      if (error.status === 400) {
        promptRegister(telephoneNumber);
      }
      else $ionicPopup.alert({
        title: "Error while trying to connect to server.",
        subTitle: error
      });
    };
  };

  var register = function(newUser) {
    return beelineRequest({
      method: 'POST',
      url: '/user',
      data: newUser
    })
    .then(function(response) {
      return true;
    });
  };

  var promptRegister = async function(telephone) {
    try {
      var accountResponse = await verifiedPrompt({
        title: 'Account Details',
        subTitle: 'Welcome! Looks like this is your first login.\
        Please complete the account setup.',
        inputs: [
          {
            type: 'text',
            name: 'name',
            pattern: VALID_USER_NAME,
            inputPlaceHolder: 'name'
          },
          {
            type: 'email',
            name: 'email',
            inputPlaceHolder: 'name@example.com'
          }
        ]
      });
      if (!accountResponse) return;
      $ionicLoading.show({template: registeringWithServerTemplate});
      var registerResponse = await register({
        name: accountResponse.name,
        email: accountResponse.email,
        telephone: telephone
      });
      $ionicLoading.hide();
      if (!registerResponse) return;
      $ionicLoading.show({template: requestingVerificationCodeTemplate});
      await sendTelephoneVerificationCode(telephone);
      $ionicLoading.hide();
      var verificationCode = await promptVerificationCode(telephone);
      if (!verificationCode) return;
      $ionicLoading.show({template: sendingVerificationCodeTemplate});
      await verifyTelephone(telephone, verificationCode.code);
      $ionicLoading.hide();
    }
    // If an error occurs at any point stop and alert the user
    catch(error) {
      $ionicLoading.hide();
      $ionicPopup.alert({
        title: "Error while trying to connect to server.",
        subTitle: error
      });
    };
  };

  // Similar to prompt login
  // The combined prompt for phone number and subsequent prompt for verification code
  var promptUpdatePhone = async function() {
    try{
      // Start by prompting for the phone number
      var telephoneResponse = await promptTelephoneNumber('Update Phone Number',
        'Please enter your new 8-digit mobile number to receive a verification code.');
      if (!telephoneResponse) return;
      $ionicLoading.show({template: requestingVerificationCodeTemplate});
      var telephone = telephoneResponse.phone;
      var updateToken = await requestUpdateTelephone(telephone);
      $ionicLoading.hide();
      var updateCode = await promptVerificationCode(telephone);
      if (!updateCode) return;
      $ionicLoading.show({template: sendingVerificationCodeTemplate});
      await updateTelephone(updateToken, updateCode.code);
      $ionicLoading.hide();
      $ionicPopup.alert({
        title: "Your phone number has been successfully updated.",
        subTitle: "It is now " + telephone
      });
    }
    // If an error occurs at any point stop and alert the user
    catch(error){
      $ionicLoading.hide();
      $ionicPopup.alert({
        title: "Error while trying to connect to server.",
        subTitle: error
      });
    };
  };

  var promptUpdateUserInfo = async function(field) {
    try {
      var filedInput;
      if (field === 'name'){
        filedInput = {
          type: 'text',
          name:  'name',
          pattern: VALID_USER_NAME,
        }
      }
      if (field === 'email'){
        filedInput = {
          type: 'email',
          name:  'email',
        }
      }
      var verifiedResponse = await verifiedPrompt({
        title: 'Update '+field,
        subTitle: 'Enter your new '+field,
        inputs: [filedInput]
      })
      if (!verifiedResponse) return;
      var update={};
      update[field] = verifiedResponse[field];
      return updateUserInfo(update);
    }
    catch(error){
      $ionicPopup.alert({
        title: `Error updating ${field}.`,
        template: ''
      });
    }
  };

  // Shows a confirmation dialogue asking if the user is sure they want to log out
  var promptLogOut = function() {
    $ionicPopup.confirm({
      title: 'Are you sure?',
      subTitle: "You won't be able to make bookings or see your tickets if you don't sign in."
    }).then(function(response) {
      if (response) {
        return logOut();
      }
    });
  };

  // ////////////////////////////////////////////////////////////////////////////
  // Initialization
  // ////////////////////////////////////////////////////////////////////////////
  verifySession();

  // ////////////////////////////////////////////////////////////////////////////
  // Public external interface
  // ////////////////////////////////////////////////////////////////////////////
  return {
    getUser: function() { return (user); },
    beeline: beelineRequest,
    promptLogIn: promptLogIn,
    promptUpdatePhone: promptUpdatePhone,
    promptUpdateUserInfo: promptUpdateUserInfo,
    promptLogOut: promptLogOut,
    verifySession: verifySession
  };

}
