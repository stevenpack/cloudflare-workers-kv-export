class ExportRunner {
    constructor() {}

    parseConf(args) {
        try {
            console.debug("Parsing args...");
            if (process.argv.length < 4 || !args[2] || !args[3]) {
                console.log("Usage: node index.js <config.toml> <apiKey>");
                process.exit(1);
            }
            let configPath = args[2];
            console.info(`Reading config from ${configPath}`);
            const fs = require("fs");
            let contents = fs.readFileSync(configPath);
            console.info(`Parsing...`);
            const toml = require("toml");
            let conf = toml.parse(contents);
            console.debug(JSON.stringify(conf, null, 2));
            conf["api_key"] = args[3];
            //console.debug(JSON.stringify(conf, null, 2));
            console.debug("OK");
            return conf;
        } catch (e) {
            console.error("Failed to initialize");
            console.error(e);
            process.exit(1);
        }
    }

    validate(conf) {
        console.info("Validating...");
        if (!conf["account_id"]) {
            console.error(`accountId required`);
            return false;
        }

        if (!conf["kv-namespaces"]) {
            console.error("kv-namespaces required");
            return false;
        }

        let namespaces = conf["kv-namespaces"];
        for (let namespace of namespaces) {
            if (!namespace.id) {
                console.error("id required on all namespace elements");
                return false;
            }
        }

        if (!conf.filename) {
            const defaultFilename = "kv.db";
            console.warn(
                `Sqlite file not found. Defaulting to ${defaultFilename}`
            );
        }
        console.debug("OK");
        return conf;
    }

    async syncNamespace(namespace, destination) {
        try {
            let keys = await namespace.getKeys();
            console.info(`${keys.length} keys to process...`);
            //TODO: parallelize in batches
            for (let key of keys) {
                try {
                    let val = await namespace.getValue(key);
                    await destination.sync(namespace, key, val);
                } catch (e) {
                    console.warn(`Failed to write ${key}. Ignoring...`);
                    console.warn(e);
                }
            }
            console.debug(`${namespace.title} complete`);
        } catch (e) {
            console.warn(
                `Failed to process namespace ${namespace.title}/${namespace.id}. Ignoring...`
            );
            console.warn(e.message);
        }
    }

    async execute(args) {
        let conf = this.parseConf(args);
        if (!this.validate(conf)) {
            return false;
        }
        let namespaces = conf["kv-namespaces"];
        let destination = new SqliteDestination(conf.filename);
        destination.init(namespaces);

        let promises = [];
        for (let namespaceConf of namespaces) {
            console.info(
                `Processing ${namespaceConf.title}/${namespaceConf.id}...`
            );
            let namespace = new Namespace(
                conf["account_id"],
                namespaceConf.id,
                namespaceConf.title,
                namespaceConf.values,
                conf["auth_email"],
                conf["api_key"]
            );
            let p = this.syncNamespace(namespace, destination);
            promises.push(p);
        }
        await Promise.all(promises);
        await destination.close();
        return "Export complete";
    }
}

/**
 * A Workers KV namespace
 */
class Namespace {
    constructor(accountId, id, title, values, email, apiKey, axiosImpl) {
        this.accountId = accountId;
        this.id = id;
        this.title = title;
        this.email = email;
        this.values = values;
        this.apiKey = apiKey;
        this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}`;
        this.axios = axiosImpl || require("axios");
    }

    async getKeys() {
        let cursor = "";
        let keys = [];
        let batchKeys = null;
        let limit = 1000;
        do {
            let listKeysUrl = `${this.baseUrl}/storage/kv/namespaces/${this.id}/keys?${limit}=1000&cursor=${cursor}`;
            console.info(`Getting keys from ${listKeysUrl}...`);
            let keysResult = await this.axios.get(listKeysUrl, {
                headers: {
                    "X-Auth-Email": this.email,
                    "X-Auth-Key": this.apiKey,
                },
            });
            // console.debug(JSON.stringify(keysResult.data), null, 2);
            // console.debug(JSON.stringify(keysResult.data.result_info), null, 2);
            cursor = keysResult.data.result_info.cursor;
            console.log("Cursor present. Will paginate...");
            batchKeys = keysResult.data.result.map((item) => item.name);
            keys = keys.concat(batchKeys);
            console.log(`Current keys=${keys.length}`);
        } while (cursor != null && batchKeys.length === limit);
        console.info(`Got ${keys.length} keys`);
        console.debug("OK");
        return keys;
    }

    async getValue(key) {
        if (this.values == "false") {
            console.debug("values flag is false. Skipping values");
            return null;
        }
        console.debug(`Getting value for ${key}...`);
        let getValueUrl = `${this.baseUrl}/storage/kv/namespaces/${this.id}/values/${key}`;
        console.info(getValueUrl);
        let valueResult = await this.axios.get(getValueUrl, {
            headers: {
                "X-Auth-Email": this.email,
                "X-Auth-Key": this.apiKey,
            },
            responseType: "text",
        });
        // console.debug(JSON.stringify(valueResult.data, null, 2));
        // process.exit(0);
        let val = valueResult.data;
        console.debug("OK");
        return JSON.stringify(val, null, 2);
    }
}

/**
 * Destination implemented as a Sqlite database
 */
class SqliteDestination {
    constructor(filename) {
        this.filename = filename;
        this.db = null;
    }

    init(namespaces) {
        const fs = require("fs");
        let exists = false;
        if (!fs.existsSync(this.filename)) {
            console.info(`${this.filename} does not exist. Will create...`);
        } else {
            console.info(`${this.filename} exists. Will open...`);
            exists = true;
        }
        try {
            //Connect or create
            const sqlite3 = require("sqlite3").verbose();
            this.db = new sqlite3.Database(this.filename, (e) => {
                if (e) {
                    console.error(e);
                }
            });
            console.info(
                `Database ${exists ? "opened" : "created"} at ${this.filename}`
            );
            this.db.serialize(() => {
                //sqlite: Create tables if not exist
                for (let namespace of namespaces) {
                    console.info(
                        `Creating table ${namespace.title} if not exist (id: ${namespace.id})`
                    );
                    this.db.run(
                        `CREATE TABLE IF NOT EXISTS ${namespace.title} (key TEXT CONSTRAINT PK_key PRIMARY KEY, val TEXT)`
                    );
                }
            });
        } catch (e) {
            console.error("Failed to init db");
            console.error(e);
        } finally {
        }
    }
    async sync(namespace, key, val) {
        let table = namespace.title;
        console.debug(`Writing ${table} --> ${key}:${val}`);
        //TODO: Make the key primary key so things get updated
        var stmt = this.db.prepare(
            `INSERT OR REPLACE INTO ${table} (key, val) VALUES (?,?)`
        );
        stmt.run(key, val);
        return new Promise((resolve, reject) => {
            stmt.finalize((e) => {
                if (e) {
                    reject(e);
                } else {
                    console.debug("Written");
                    resolve();
                }
            });
        });
    }

    async close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((e) => {
                    if (e) {
                        reject(e);
                    } else {
                        console.info("DB closed");
                        resolve();
                    }
                });
                this.db = null;
            } else {
                resolve();
            }
        });
    }
}
module.exports = { SqliteDestination, Namespace, ExportRunner };
