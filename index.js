const {
    default: makeWASocket,
    BufferJSON,
    DisconnectReason,
    useSingleFileAuthState,
} = require("@whiskeysockets/baileys");
process.setMaxListeners(0);

const http = require("http");
const express = require("express");
const bodyParser = require("body-parser");
const port = 9000;
const fs = require("fs");
const qrcode = require("qrcode");
const pino = require("pino");
const socketIO = require("socket.io");

const con = require("./core/core.js");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const path = "./core/";

const { body, validationResult } = require("express-validator");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

io.on("connection", (socket) => {
    socket.on("StartConnection", async(device) => {
        if (fs.existsSync(path.concat(device) + ".json")) {
            socket.emit("message", "Whatsapp On");
            socket.emit("ready", device);
            con.gas(null, device);
        } else {
            const { state, saveState } = useSingleFileAuthState(
                path.concat(device) + ".json"
            );

            const sock = makeWASocket({
                printQRInTerminal: false,
                auth: state,
                logger: pino({ level: "fatal" }),
                browser: ["chrome"],
            });
            sock.ev.on("connection.update", (update) => {
                const { connection, lastDisconnect, qr, isNewLogin } = update;

                if (qr) {
                    qrcode.toDataURL(qr, (err, url) => {
                        socket.emit("qr", url);
                        socket.emit("message", "QR Code received, scan please!");
                    });
                }

                if (connection == "close") {
                    con.gas(null, device);
                    console.log(device);
                    socket.emit("message", "Whatsapp connected");
                    socket.emit("ready", device);
                }
                console.log(connection);
            });
            sock.ev.on("creds.update", saveState);
        }
    });

    socket.on("LogoutDevice", (device) => {
        if (fs.existsSync(path.concat(device) + ".json")) {
            fs.unlinkSync(path.concat(device) + ".json");
            console.log("logout device " + device);

            socket.emit("message", "logout device " + device);
        }
        return;
    });
});

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/core/home.html");
});

app.get("/device", (req, res) => {
    res.sendFile(__dirname + "/core//device.html");
});

app.get("/scan/:id", (req, res) => {
    const no = req.params.id;
    console.log(no);
    res.sendFile(__dirname + "/core//index.html");
});

app.post(
    "/send", [
        body("number").notEmpty(),
        body("message").notEmpty(),
        body("to").notEmpty(),
    ],
    async(req, res) => {
        const errors = validationResult(req).formatWith(({ msg }) => {
            return msg;
        });

        if (!errors.isEmpty()) {
            return res.status(422).json({
                status: false,
                message: errors.mapped(),
            });
        } else {
            var number = req.body.number;
            var to = req.body.to;
            var msg = req.body.message;

            if (fs.existsSync(path.concat(number) + ".json")) {
                const ps = con.gas(msg, number, to);

                res.writeHead(200, {
                    "Content-Type": "application/json",
                });
                res.end(
                    JSON.stringify({
                        status: true,
                        message: "sukses",
                    })
                );
            } else {
                res.writeHead(401, {
                    "Content-Type": "application/json",
                });
                res.end(
                    JSON.stringify({
                        status: false,
                        message: "Please scan the QR before use the API",
                    })
                );
            }
        }
    }
);

app.post("/device", (req, res) => {
    const device = req.body.device;

    if (fs.existsSync(path.device + ".json")) {
        res.writeHead(301, { "Content-Type": "text/html" });
        res.write(
            "<h1>Number sudah di gunakan, silahkan kembali dan input yang lain<h1>"
        );
        res.end();
    } else {
        res.redirect("/scan/" + device);
    }
});

server.listen(port, function() {
    console.log("App running on : " + port);
});