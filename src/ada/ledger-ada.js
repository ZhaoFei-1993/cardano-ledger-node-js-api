/********************************************************************************
 *   Ledger Node JS API
 *   (c) 2016-2017 Ledger
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 ********************************************************************************/

const Q = require('q');
const utils = require('../utils');
const Int64 = require('node-int64');

/**
 * @class LedgerAda
 * @author StaceC - HiddenField Ltd
 * @version 0.1.0
 * @description
 * Class uses the underlying Ledger comms layer to communicate with the Cardano Ledger App.
 *
 * All methods return a result object containing a `success` boolean.
 *
 * ### ADA APDU I/O Buffer Structure
 *
 * #### Header
 * * buffer[0] = APDU IDENTIFIER
 * * buffer[1] = INSTRUCITON NO
 * * buffer[2] = P1 VALUE
 * * buffer[3] = P2 VALUE
 * * buffer[4..7] = CDATA_LENGTH
 *
 * #### Data
 * * buffer[...] = DATA
 * * buffer[END] = 0x9000 OKAY
 *
 * @example
 * const ada = new ledger.ada(comm);
 *
 */
const LedgerAda = function(comm) {
  this.comm = comm;
  this.comm.setScrambleKey('ADA');

  /**
   * Check whether a given APDU response was successful.
   *
   * @param {Object} apduResponse The APDU response.
   * @return True if response is successful.
   * @private
   */
  function isApduSuccess(apduResponse) {
    return LedgerAda.SUCCESS_CODE === apduResponse.slice(apduResponse.length-4, apduResponse.length);
  }

  /**
   * Generic method to respond to known error codes.
   *
   * @returns {Error<{success:boolean, code:number, msg:string }>} the error code and message.
   * @private
   */
  function handleError(errorMsg) {

    var error = {success : false};

    const [ errorStatus ] = errorMsg.toUpperCase().match(/([0-9A-F]{4})$/gm) || [ '0000' ];
    const errorCode = `0x${errorStatus}`;

    if (errorCode === '0x0000') {
      error['msg'] = "Unknown Error"
      return error;
    }

    error['code'] = errorCode;

    switch(errorCode) {
        case LedgerAda.Error.APP_NOT_RUNNING:
          error['msg'] = "Cardano App is not installed or not running on the Ledger.";
          break;
        case LedgerAda.Error.INS_NOT_AVAILABLE:
          error['msg'] = "Instruction not available on this build."
          break;
        default:
          error['msg'] = "Invalid Status";
    }

    return error;
  }
}

/**
 * @description Get a public key from the specified BIP 32 index.
 * The BIP 32 index is from the path at `44'/1815'/0'/[index]`.
 *
 * @param {number} index The index to retrieve.
 * @return {Promise<{ success:boolean, publicKey:string }>} The public key for the given index.
 *
 * @throws 5201 - Non-hardened index passed in, Index < 0x80000000
 * @throws 5202 - Invalid header
 * @throws 5003 - Index not a number
 *
 * @example
 * ada.getWalletPublicKeyWithIndex(0xC001CODE)
 *  .then((response) => {
 *    console.log(response.publicKey);
 *  })
 *  .catch(error => console.log(error));
 *
 */
LedgerAda.prototype.getWalletPublicKeyWithIndex = function(index) {

  if(isNaN(index)) {
    return Q.reject("Invalid status " + LedgerAda.Error.INDEX_NAN);
  }

  var buffer = Buffer.alloc(LedgerAda.OFFSET_CDATA + 4);
  buffer[0] = 0x80;
  buffer[1] = LedgerAda.INS_GET_PUBLIC_KEY;
  buffer[2] = 0x02;
  buffer[3] = 0x00;
  // Data Length
  buffer.writeUInt32BE(4, LedgerAda.OFFSET_LC);
  // Data
  buffer.writeUInt32BE(index, LedgerAda.OFFSET_CDATA);

  return this.comm.exchange(buffer.toString('hex'), [0x9000]).then(function(response) {
    var result = {};
    response = Buffer.from(response, 'hex');
    var publicKeyLength = response[0];
    result['success'] = true;
    result['publicKey'] = response.slice(1, 1 + publicKeyLength).toString('hex');

    return result;
  });
}


/**
 * @description Get the root extended public key of the wallet,
 * also known as the wallet recovery passphrase.
 * BIP 32 Path M 44' /1815'
 * 32 Byte Public Key
 * 32 Byte Chain Code
 *
 * @return {Promise<{success:boolean, publicKey:string, chainCode:string }>} The result object containing the root wallet public key and chaincode.
 *
 * @example
 * ada.getWalletRecoveryPassphrase()
 *  .then((response) => {
 *    console.log(response.publicKey);
 *    console.log(response.chainCode);
 *  })
 *  .catch(error => console.log(error));
 *
 */
LedgerAda.prototype.getWalletRecoveryPassphrase = function() {
  var buffer = Buffer.alloc(LedgerAda.OFFSET_CDATA);

  buffer[0] = 0x80;
  buffer[1] = LedgerAda.INS_GET_PUBLIC_KEY;
  buffer[2] = 0x01;
  buffer[3] = 0x00;
  // Data Length
  buffer.writeUInt32BE(0, LedgerAda.OFFSET_LC);

  return this.comm.exchange(buffer.toString('hex'), [0x9000]).then(function(response) {
    var result = {};
    response = Buffer.from(response, 'hex');
    var publicKeyLength = response[0];
    result['success'] = true;
    result['publicKey'] = response.slice(1, 1 + publicKeyLength).toString('hex');
    result['chainCode'] = response.slice(1 + publicKeyLength, 1 + publicKeyLength + 32).toString('hex');
    return result;
  });
}


/**
 * Set the transaction.
 *
 * @param {string} txHex The transaction to be set.
 * @return {Promise<Object>} The response from the device.
 * @private
 */
LedgerAda.prototype.setTransaction = function(txHex) {
  var apdus = [];
  var response = [];
  var offset = 0;
  var headerLength = LedgerAda.OFFSET_CDATA;
  var tx = '';
  var self = this;

  try {
    tx = new Buffer(txHex, 'hex');
  } catch (error) {
    return Q.reject(error);
  }

  var maxChunkSize = LedgerAda.MAX_APDU_SIZE - headerLength;
  var isSingleAPDU = tx.length < maxChunkSize;

  while (offset != tx.length) {

    var isLastAPDU = tx.length - offset < maxChunkSize;
    var chunkSize = (isLastAPDU ? tx.length - offset : maxChunkSize);
    var buffer = new Buffer(headerLength + chunkSize);
    // Header
    buffer[0] = 0x80;
    buffer[1] = LedgerAda.INS_SET_TX;
    buffer[2] = (offset == 0 ? 0x01 : 0x02);
    buffer[3] = (isSingleAPDU ? 0x01 : 0x02);
    buffer.writeUInt32BE( offset == 0 ? tx.length : chunkSize, 4);
    // Body
    // Body
    tx.copy(buffer, headerLength, offset, offset + chunkSize);

    apdus.push(buffer.toString('hex'));

    offset += chunkSize;
  }

  return utils.foreach(apdus, function(apdu) {
    return self.comm.exchange(apdu, [0x9000]).then(function(apduResponse) {
      var result = {};

      var responseHexLength = apduResponse.toString('hex').length;
      //console.log("FROM[" + (responseHexLength-4) + "] TO[" + responseHexLength + "]")
      //console.log("SLICE:" + apduResponse.slice(responseHexLength-4, responseHexLength).toString('hex'));

      result['success'] = "9000" ===
        apduResponse.slice(responseHexLength - LedgerAda.CODE_LENGTH, responseHexLength) ?
        true : false;
      result['respLength'] = apduResponse.toString('hex').length;
      result['resp'] = apduResponse.toString('hex');
      if(apduResponse.length > LedgerAda.CODE_LENGTH) {
        response = Buffer.from(apduResponse, 'hex');
        var offset = 0;
        result['TxInputCount'] = response.readUInt8(offset++);
        result['TxOutputCount'] = response.readUInt8(offset++);
        for(var i=0; i<result['TxOutputCount']; i++) {
            result['Address_' + i] = response.slice(
                  offset, offset + LedgerAda.MAX_ADDR_PRINT_LENGTH).toString();
            offset += LedgerAda.MAX_ADDR_PRINT_LENGTH;
            result['Amount_' + i] = tx.amount = new Int64(
              response.readUInt32LE(offset + (LedgerAda.AMOUNT_SIZE/2)),
              response.readUInt32LE(offset)).toOctetString();
            offset+= LedgerAda.AMOUNT_SIZE;
        }
        // Read 256bit (32 byte) hash
        //result['txLength'] = apduResponse.slice(offset, offset + 16).toString('hex');
        //offset += 16;
        //result['tx'] = apduResponse.slice(offset, offset + LedgerAda.TX_HASH_SIZE).toString('hex');
      }

      return result;
    });
  });
}


/**
 * Sign the set transaction with the given indexes.
 * Note that setTransaction must be called prior to this being called.
 *
 * @param {number[]} indexes The indexes of the keys to be used for signing.
 * @returns {Array.Promise<Object>} An array of result objects containing a digest for each of the passed in indexes.
 * @private
 */
LedgerAda.prototype.signTransactionWithIndexes = function(indexes) {
  var apdus = [];
  var response = [];
  var offset = 0;
  var headerLength = LedgerAda.OFFSET_CDATA;
  var tx = '';
  var self = this;

  var signingCounter = indexes.length;

  for(var i = 0; i<indexes.length; i++) {

    if(isNaN(indexes[i])) {
      var result = {};
      result['success'] = false;
      result['code'] = LedgerAda.Error.INDEX_NAN;
      result['error'] = "Address index is not a number."
      return Q.reject(result);
    }

    if(indexes[i] > 0xFFFFFFFF) {
      var result = {};
      result['success'] = false;
      result['code'] = LedgerAda.Error.INDEX_MAX_EXCEEDED;
      result['error'] = "Address index exceeds maximum."
      return Q.reject(result);
    }

    var buffer = new Buffer(headerLength + 4);
    // Header
    buffer[0] = 0x80;
    buffer[1] = LedgerAda.INS_SIGN_TX;
    buffer[2] = 0x00;
    buffer[3] = 0x00;
    // Data Length
    buffer.writeUInt32BE(4, LedgerAda.OFFSET_LC);
    // Data
    buffer.writeUInt32BE(indexes[i], LedgerAda.OFFSET_CDATA);

    apdus.push(buffer.toString('hex'));
  }

  return utils.foreach(apdus, function(apdu) {
    return self.comm.exchange(apdu, [0x9000]).then(function(apduResponse) {
      var result = {};

      var responseHexLength = apduResponse.toString('hex').length;
      response = Buffer.from(response, 'hex');

      result['success'] = "9000" ===
        apduResponse.slice(responseHexLength-4, responseHexLength) ?
        true : false;
      result['digest'] = apduResponse.slice(0, responseHexLength-4);

      return result;
    });
  });
}


/**
 * @description Signs a hex encoded transaction with the given indexes.
 * The transaction is hased using Blake2b on the Ledger device.
 * Then, signed by the private key derived from each of the passed in indexes at
 * path 44'/1815'/0'/[index].
 *
 * @param {string} txHex The transaction to be signed.
 * @param {number[]} indexes The indexes of the keys to be used for signing.
 * @return {Array.Promise<{success:boolean, digest:string }>} An array of result objects containing a digest for each of the passed in indexes.
 *
 * @throws 5001 - Tx > 1024 bytes
 * @throws 5301 - Index < 0x80000000
 * @throws 5302 - Index > 0xFFFFFFFF
 * @throws 5003 - Index not a number
 *
 * @example
 * const transaction = '839F8200D8185826825820E981442C2BE40475BB42193CA35907861D90715854DE6FCBA767B98F1789B51219439AFF9F8282D818584A83581CE7FE8E468D2249F18CD7BF9AEC0D4374B7D3E18609EDE8589F82F7F0A20058208200581C240596B9B63FC010C06FBE92CF6F820587406534795958C411E662DC014443C0688E001A6768CC861B0037699E3EA6D064FFA0';
 * ada.signTransaction(transaction, [0xF005BA11])
 *  .then((response) => {
 *    console.log('Signed successfully: %s', response.digest);
 *  })
 *  .catch(error => console.log(error));
 *
 */
LedgerAda.prototype.signTransaction = function(txHex, indexes) {
    return this.setTransaction(txHex)
      .then(result => this.signTransactionWithIndexes(indexes));
}


/**
 * Checks if the device is connected and if so, returns an object
 * containing the app version.
 *
 * @returns {Promise<{success:boolean, major:number, minor:number, patch:number}>} Result object containing the application version number.
 *
 * @example
 * ada.isConnected()
 *  .then((response) => {
 *    const { major, minor, patch } = response;
 *    console.log('App version %d.%d.%d: ', major, minor, patch);
 *  })
 *  .catch(error => console.log(error));
 *
 */
LedgerAda.prototype.isConnected = function() {
  var buffer = Buffer.alloc(LedgerAda.OFFSET_CDATA);

  buffer[0] = 0x80;
  buffer[1] = LedgerAda.INS_APP_INFO;
  buffer[2] = 0x00;
  buffer[3] = 0x00;
  // Data Length
  buffer.writeUInt32BE(0, LedgerAda.OFFSET_LC);

  return this.comm.exchange(buffer.toString('hex'), [0x9000]).then(function(response) {
    var result = {};
    response = Buffer.from(response, 'hex');
    result['success'] = true;
    result['major'] = response[0];
    result['minor'] = response[1];
    result['patch'] = response[2];
    return result;
  }).catch((error) => this.handleError(error));
}

LedgerAda.SUCCESS_CODE = "9000";
LedgerAda.CODE_LENGTH = 4;
LedgerAda.AMOUNT_SIZE = 8;
LedgerAda.TX_HASH_SIZE = 64;
LedgerAda.MAX_APDU_SIZE = 64;
LedgerAda.MAX_TX_HEX_LENGTH = 2048;
LedgerAda.MAX_MSG_LENGTH = 248;
LedgerAda.MAX_ADDR_PRINT_LENGTH = 12;
LedgerAda.OFFSET_CDATA = 8;
LedgerAda.OFFSET_LC = 4;
// Instruction Setup - Should match main.c
LedgerAda.INS_GET_PUBLIC_KEY = 0x01;
LedgerAda.INS_SET_TX = 0x02;
LedgerAda.INS_SIGN_TX = 0x03;
LedgerAda.INS_APP_INFO = 0x04;
LedgerAda.INS_BLAKE2B_TEST = 0x07;
LedgerAda.INS_BASE58_ENCODE_TEST = 0x08;
LedgerAda.INS_CBOR_DECODE_TEST = 0x09;
// Error Codes
LedgerAda.Error = {};
LedgerAda.Error.MAX_TX_HEX_LENGTH_EXCEEDED = 5001;
LedgerAda.Error.MAX_MSG_LENGTH_EXCEEDED = 5002;
LedgerAda.Error.INDEX_NAN = 5003;
LedgerAda.Error.INDEX_MAX_EXCEEDED = 5302;
LedgerAda.Error.APP_NOT_RUNNING = 0x6E00;
LedgerAda.Error.INS_NOT_AVAILABLE = 0x6D00;

module.exports = LedgerAda;