const axios = require("axios").default;
const { exec } = require("child_process");
const fs = require("fs");
const archiver = require("archiver");
const putasset = require("putasset");
const { Octokit } = require("@octokit/rest");
require("dotenv").config();

const token = process.env.GITHUB_TOKEN;

const repo = {
    owner: "The0Show",
    name: "gmml-prebuilt",
};

const buildPath = "gmml/GmmlPatcher/bin/win-x64-net6.0/Release";

async function checkForNewBuilds() {
    console.clear();
    console.log(Date.now());
    
    const commitLog = await axios
        .get(`https://api.github.com/repos/cgytrus/gmml/commits`)
        .then((res) => res.data);

    if (!fs.existsSync("buildCount.txt"))
        fs.writeFileSync("buildCount.txt", "");
    const builtNum = fs.readFileSync("buildCount.txt").toString();

    console.log("commit sha: ", commitLog[0].sha);
    console.log("built commit: ", builtNum);

    if (commitLog[0].sha != builtNum) {
        fs.writeFileSync("buildCount.txt", commitLog[0].sha);

        console.log("changes detected: starting build");

        exec("start startbuild.bat", (err, stdout, stderr) => {
            if (err) {
                console.error(err);
                return;
            }
            console.log("build completed");
            if (!fs.existsSync(buildPath)) {
                console.log(
                    "could not find build folder - build may have failed"
                );
            } else {
                var output = fs.createWriteStream("gmml.zip");
                var archive = archiver("zip");

                output.on("close", async function () {
                    console.log(archive.pointer() + " total bytes");
                    console.log(
                        "archiver has been finalized and the output file descriptor has closed."
                    );

                    const octokit = new Octokit({
                        auth: `token ${token}`,
                    });
					
                    var today = new Date();
                    var dd = String(today.getDate()).padStart(2, '0');
                    var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
                    var yyyy = today.getFullYear();

					today = mm + '/' + dd + '/' + yyyy;
					
					let buildTag = Date.now().toString()

                    await octokit.repos.createRelease({
                        owner: repo.owner,
                        repo: repo.name,
                        tag_name: buildTag,
                        name: `Build #${Date.now()}`,
                        body: `Build output for the latest commits to [GMML](https://github.com/cgytrus/gmml).\n\nBuilt on ${today}`,
                    });

                    await putasset(token, {
                        owner: repo.owner,
                        repo: repo.name,
                        tag: buildTag,
                        filename: "gmml.zip",
                    })
                        .then((url) => {
                            console.log(`Upload success, download url: ${url}`);
                        })
                        .catch((error) => {
                            console.error(error.message);
                        });
                });

                archive.on("error", function (err) {
                    throw err;
                });

                archive.pipe(output);

                // append files from a sub-directory and naming it `new-subdir` within the archive
                archive.directory(
                    buildPath,
                    false
                );

                archive.finalize();
            }
        });
    } else {
        console.log("no new build needed");
    }
}

checkForNewBuilds();
setInterval(async () => await checkForNewBuilds(), 3600000);
