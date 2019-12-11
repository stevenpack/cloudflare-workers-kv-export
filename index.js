const toml = require('toml');
const fs = require('fs');
const axios = require('axios');

let runner = new ExportRunner();
runner.execute(process.argv)
    .then(res => console.log(res))
    .catch(e => console.error(e));


class ExportRunner {
    constructor() {}

    parseConf(args) {
        let configPath = args[2];
        console.info(configPath);
        let contents = fs.readFileSync(configPath);
        let conf = toml.parse(contents);
        console.debug(JSON.stringify(conf));
        return conf;
    }

    validate(conf) {
        if (!conf.accountId) {
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
                console.error('id required on all namespace elements');
                return false;
            }
        }

        if (!conf.filename) {
            const defaultFilename = "kv.db";
            console.warn(`Sqlite file not found. Defaulting to ${defaultFilename}`);
        }
    }

    async execute(args) {
        //TODO: parseArgs
        //TODO: validate, accountId, kv-namespaces, sqlitefilename        
        let conf = this.parse(args);
        let namespaces = conf["kv-namespaces"];
        let destination = new SqliteDestination(conf.filename);
        await destination.init(namespaces);
        
        for (let namespaceConf of namespaces) {
            let namespace = new Namespace(conf.accountId, namespaceConf.id, namespaceConf.title);
            let keys = namespace.getKeys(namespaceId);
            for (let key of keys) {
                let val = namespace.getValue(key);
                destination.sync(key, val);
            }
        }
    }
}

class Namespace {
    constructor(accountId, namespaceId, title) {
        this.accountId = accountId;
        this.namespaceId = namespaceId;
        this.title = title;
        this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${conf.accountId}`;
    }

    async getKeys() {

        let listKeysUrl = `${this.baseUrl}/${this.id}/keys`;
        let keysResult = await axios.get(listKeysUrl);
        let keys = keysResult.data;
        return keys;
    }

    async getValue(key) {
        let getValueUrl = `${this.baseUrl}/storage/kv/namespaces/${this.id}/values/${key}`;
        let valueResult = await axios.get(getValueUrl);
        let val = valueResult.data;
        return val;
    }
}

class SqliteDestination {
    constructor() {        
    }

    async init(keys) {
        //sqlite: Create file if not exists
        //sqlite: Create tables if not exist
    }
    async sync(key, val) {
        //sqlite: Insert or update value
    }

}