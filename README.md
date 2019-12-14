# cloudflare-workers-kv-export
Export your Cloudflare Workers KV namespaces to sqlite for querying

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

## Installation
`npm install`
