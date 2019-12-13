const assert = require('assert');

/**
 * Not full coverage, but exercises most code paths
 */
describe('Export', function() {
    
    it('Can write to sqlite', async function() {
        const fs = require('fs');
        const {SqliteDestination} = require('../lib');
        //delete 
        if (fs.existsSync("test.db")) {
            fs.unlinkSync("test.db");    
        }
        let namespaces = [
            {
                id: "xxx",
                title: "TEST_NS1"
            },
            {
                id: "yyy",
                title: "TEST_NS2"
            }
    
        ]
        let destination = new SqliteDestination("test.db");
        destination.init(namespaces);
        let ns1 = namespaces[0];
        destination.sync(ns1, "KEY1", "VAL1");
        await destination.close();
    
        console.log("Test DB created and test data written...");
        const sqlite3 = require('sqlite3').verbose();
        let testDb = new sqlite3.Database("test.db", (e) => {
            if (e) {
                console.error(e);
            } else {
                console.info("Connected to test.db");
            }
        });
        testDb.each("SELECT * FROM TEST_NS1", function(err, row) {
            console.log("Result of select");
            console.log(JSON.stringify(err || row));
            assert.equal(row.key, "KEY1");
            assert.equal(row.val, "VAL1");
        });
        testDb.close();
    });

    it('Can process kv data', async function() {
        let mockAxios = {
            get: function(url, conf) {
                return new Promise((resolve, reject) => {
                    if (url.indexOf("/keys") > -1) {
                        let keys = [
                            {name: "100"},
                            {name: "200"}
                        ]
                        resolve({
                            data: {result: keys}
                        });
                    }
                    else if (url.indexOf("/values") > -1) {
                        resolve({
                            data: "some val"
                        });
                    } else {
                        reject("Unknown url");
                    }
                });
            }
        };
    
        const {Namespace} = require('../lib');
        let testNs = new Namespace("abc", "xyz", "NS_TEST1", "a@b.com", "xxx", mockAxios);
        let keys = await testNs.getKeys();
        assert.equal(keys[0], "100");
        let val = await testNs.getValue(keys[0]);
        //TOOD: if the kv val is text, this may not be what you want...
        //Should probably configure axios to return it raw and not as parsed
        assert.equal(val, "\"some val\"");
    });

})

async function sqlIntegrationTest() {
    //TODO: Use mocha
    
}

async function namespaceUnitTest() {

}

// // namespaceUnitTest()
// //     .catch(e => console.error(e))
// //     .finally(() => console.log("done"));

// sqlIntegrationTest()
//     .catch(e => console.error(e))
//     .finally(() => console.log("done"));