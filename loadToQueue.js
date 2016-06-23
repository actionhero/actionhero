const person = require("./test/data/person_phone_w_dash.json");

function load() {
    var http = require("http");

    var options = {
        "method": "POST",
        "hostname": "localhost",
        "port": "8080",
        "path": "/api/loadQueue",
        "headers": {
            "content-type": "application/json",
            "cache-control": "no-cache",
            "postman-token": "4fd9ac22-5893-7085-cf84-61ac38ff5271"
        }
    };

    var req = http.request(options, function(res) {
        var chunks = [];

        res.on("data", function(chunk) {
            chunks.push(chunk);
        });

        res.on("end", function() {
            var body = Buffer.concat(chunks);
            console.log(body.toString());
        });
    });

    req.write(JSON.stringify({
        id: "test",
        params: person
    }));
    req.end();
}

setInterval(load, 100);
