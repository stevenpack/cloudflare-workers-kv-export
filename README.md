# cloudflare-workers-kv-export
Export your Cloudflare Workers KV namespaces to sqlite for querying

Helpful if you need to explore your KV data with SQL, such as joining, extracting JSON values etc.

## Installation
`npm install`

## Usage
`Usage: node export <config.toml> <apiKey>`

Sample config.toml
```
account_id = "xxx"
auth_email = "john@example.com"
filename = "kv.db"

# You can suppress values being written, such as if values are large
kv-namespaces = [
         { title = "NAMESPACE_1", id = "yyy" },
         { title = "BIG_NAMESPACE_2", id = "zzz", values = "false" },
]
```
## Features
- Creates a table in a local sqlite db for each KV Namespace you specify in the toml
- Paginates keys for namespaces with > 1000 keys
- Upserts to support re-runs
- Can get or supress retrieving the values
