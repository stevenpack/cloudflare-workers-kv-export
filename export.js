//GO
const { ExportRunner } = require("./lib");
let runner = new ExportRunner();
runner
    .execute(process.argv)
    .then((res) => console.log(res))
    .catch((e) => console.error(e));
