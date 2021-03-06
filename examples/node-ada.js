const ledger = require('../src');
ledger
	.comm_node
	.create_async()
	.then(function(comm) {
			console.log(comm.device.getDeviceInfo());

			var testTX = "839f8200d81858268258204806bbdfa6bbbfea0443ab6c301f6d7d04442f0a146877f654c08da092af3dd8193c508200d818582682582060fc8fbdd6ff6c3b455d8a5b9f86d33f4137c45ece43abb86e04671254e12c08197a8bff9f8282d818585583581ce6e37d78f4326709af13851862e075bce800d06401ad5c370d4d48e8a20058208200581c23f1de5619369c763e19835e0cb62c255c3fca80aa13057a1760e804014f4e4ced4aa010522e84b8e70a121894001ae41ef3231b0075fae341e487158282d818585f83581cfd9104b3efb4c7425d697eeb3efc723ef4ff469e7f37f41a5aff78a9a20058208200581c53345e24a7a30ec701611c7e9d0593c41d6ea335b2eb195c9a0d2238015818578b485adc9d142b1e692de1fd5929acfc5a31332938f192011ad0fcdc751b0003d8257c6b4db7ffa0";

			// Blake2b Hashed Transaction
			var testTX2 =
			"839f8200d8185826825820de3151a2d9cd8e2bbe292a6153d679d123892ddcfbee869c4732a5c504a7554d19386cff9f8282d818582183581caeb153a5809a084507854c9f3e5795bcca89781f9c386d957748cd42a0001a87236a1f1b00780aa6c7d62110ffa0"
			// Address Single I/O test case
			var testTX22 =
			"839f8200d8185826825820e981442c2be40475bb42193ca35907861d90715854de6fcba767b98f1789b51219439aff9f8282d818584a83581ce7fe8e468d2249f18cd7bf9aec0d4374b7d3e18609ede8589f82f7f0a20058208200581c240596b9b63fc010c06fbe92cf6f820587406534795958c411e662dc014443c0688e001a6768cc861b0037699e3ea6d064ffa0";


			// Random Short Hash Data
			var testTX3 =
			"839f8200d8185826825820de3151a2d9cd8e2bbe292a6153d679";

			var rawTestAddress1 = "82d818584a83581ce7fe8e468d2249f18cd7bf9aec0d4374b7d3e18609ede8589f82f7f0a20058208200581c240596b9b63fc010c06fbe92cf6f820587406534795958c411e662dc014443c0688e001a6768cc86";
			var rawTestAddress2 = "82d818584a83581ce7fe8e468d2249f18cd7bf9aec0d4374b7d3e18609ede8589f82f7f0a20058208200581c240596b9";
			var rawTestAddress3 = "82d818584a83581ce7fe8e468d2249f18cd7bf9aec0d4374b7d3e18609ede8589f82f7f0a2005820820058";
			var rawTestAddress4 = "82d818584a83581ce7fe8e468d2249f18cd7bf9aec0d4374b7d3e1";


			var ada = new ledger.ada(comm);
			/*
			ada.getWalletPublicKey_async("44'/1815'/0'").then(
		     function(result) {
					 console.log("Deriving Wallet Recovery Passphrase");
					 console.log(result);
				 }).fail(
		     function(error) { console.log(error); });

			 ada.getWalletPublicKey_async("44'/1815'/0'/0'/0'").then(
 		     function(result) {
 					 console.log("Deriving Wallet Recovery Passphrase");
 					 console.log(result);
 				 }).fail(
 		     function(error) { console.log(error); });

			ada.getWalletPublicKey_async("44'/1815'/0'/0'/0'").then(
		     function(result) {
					 console.log("Deriving Wallet Recovery Passphrase");
					 console.log(result);
				 }).fail(
		     function(error) { console.log(error); });


			ada.getRandomWalletPublicKey_async().then(
 		     function(result) {
					 console.log("Generating Random Public Key in address space");
					 console.log(result);
				 }).fail(
 		     function(error) { console.log(error); });


		  var testAddress = 0xFFFFFFFF;
			ada.getWalletPublicKeyFrom_async(testAddress).then(
		     function(result) {
					 console.log("Deriving Public Key from passed in address index");
					 console.log(result);
				 }).fail(
		     function(error) { console.log(error); });

			ada.getWalletIndex_async().then(
				 function(result) {
					 console.log("Deriving Wallet Index from device seed");
					 console.log(result);
				 }).fail(
				 function(error) { console.log(error); });




*/
			console.log("\n\n\nSTART - Signing Transaction");
			ada.signTransaction_async(testTX22).then(
					function(result) {
						  console.log(result);
							console.log("END - Signing Transaction\n\n\n");
					}).fail(
					function(error) { console.log(error); });

/*
			console.log("\n\n\nSTART - Hashing Transaction");
			ada.hashTransaction_async(testTX2).then(
					function(result) {
						  console.log(result);
							console.log("END - Hashing Transaction\n\n\n");
					}).fail(
					function(error) { console.log(error); });
*/
/*
			console.log("\n\n\nSTART - Test Encoding Address");
			ada.testBase58Encode_async(rawTestAddress1).then(
					function(result) {
							console.log(result);
							console.log("END - Test Encoding Address\n\n\n");
					}).fail(
					function(error) { console.log(error); });
*/

	})
	.catch(function(reason) {
		console.log('An error occured: ', reason);
	});
