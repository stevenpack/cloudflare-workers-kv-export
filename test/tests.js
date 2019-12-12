
async function sqlIntegrationTest() {
    //TODO: Use mocha
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
        // assert(row.key === "KEY1");
        // assert(row.val === "VAL1");
    });
    testDb.close();
}

async function namespaceUnitTest() {
    let mockAxios = {
        get: function(url, conf) {
            return new Promise((resolve, reject) => {
                if (url.indexOf("/keys") > -1) {
                    let keys = [
                        "100",
                        "200"
                    ]
                    resolve({
                        data: keys
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
    //assert(keys[0] === "100");
    let val = await testNs.getValue(keys[0]);
    //assert(val === "some val");
}

// namespaceUnitTest()
//     .catch(e => console.error(e))
//     .finally(() => console.log("done"));

sqlIntegrationTest()
    .catch(e => console.error(e))
    .finally(() => console.log("done"));