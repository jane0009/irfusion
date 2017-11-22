const React = require("react")
const ReactDOM = require("react-dom")

const config = JSON.parse(JSON.stringify(require("./config.json")))

const $ = require('jquery')

const irc = require('irc');

const linkifyStr = require('linkifyjs/string');
const linkifyHtm = require('linkifyjs/html');
const Parser = require('html-react-parser');

const notificationHandler = notify = require('electron-notify');

const path = require('path');

notificationHandler.setConfig({
        appIcon: path.join( __dirname, "icon.ico"),
        displayTime: 3000
    })

var clientObject = {};
var fallback = '';
for (key in config.servers) {
    //console.log(key + config.servers[key])
    if (fallback == '') fallback = key;
    clientObject[key] = new irc.Client(key, config.username ? config.username : "irfusion", {
        port: config.servers[key]
    })
}
//console.log(clientObject)
//console.log(fallback)


let registeredChannels = [];
let channelObject = {}
let currentChannel = 'motd';
let currentServer = fallback;
//console.log(currentServer)
function sendNotification(message="", title) {
    notify.notify({text:message,title:title ? title : "IrfusIon"})
}
function addChannel(channelText) {
    let q = document.querySelector(".channels-list .scroller");
    let temp = document.createElement("div");
    temp.className = "channel-wrapper";
    if (channelText.startsWith("#")) {
        q.appendChild(temp);
    } else {
        q.insertBefore(temp, q.firstChild)
    }
    ReactDOM.render(
        React.createElement(IrcChannel, {
            channelName: channelText
        }),
        temp
    )
}
function removeChannel(name) {
    $(".channel-wrapper").each((i,el)=>{
        if(el.innerText == name) {
            el.remove()
        }
    })
}
function leaveChannel(chan) {
    if(!chan.startsWith("#")) chan = "#" + chan;
    for(key in clientObject) {
        clientObject[key].part();
    }
}
function moveDivToBottom(div) {
    div.scrollTop = div.scrollHeight;
}
function sendMessage(username, messageText, time, useBreak = false) {
    let q = document.querySelector(".messages-wrapper .scroller");
    let reg = /(https?:\/\/[\w\d\.\/]*\.(?:png|jpg))/g;
    let temp = document.createElement("div");
    temp.className = "message";
    q.appendChild(temp);
    let breaker = document.createElement("br");
    if (useBreak) q.appendChild(breaker);
    if (reg.test(messageText)) {
        let embedWrapper = document.createElement("div")
        embedWrapper.className = "image-wrapper"
        insertAfter(embedWrapper, temp);
        embedImage(messageText.match(reg), embedWrapper);
    }
    ReactDOM.render(React.createElement(IrcMessage, {
        username: username,
        messageText: Parser(messageText),
        timestamp: time
    }), temp);
}

function insertAfter(newNode, referenceNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}

function embedImage(matchArr, eWrap) {
    let sorted = uniq(matchArr);
    console.log(sorted);
    for (i in sorted) {
        let img = document.createElement('img');
        img.src = sorted[i];
        eWrap.appendChild(img);
    }
}

function uniq(a) {
    var seen = {};
    return a.filter(function (item) {
        return seen.hasOwnProperty(item) ? false : (seen[item] = true);
    });
}

function defaultMessageCallback(text) {
    alert("Function has no callback, returned " + text)
    //console.log(text);
}

function getMessages(channel) {
    //console.log(channel);
    //console.log(channelObject)
    return channelObject[channel].messages;
}

function removePreviousMessages() {
    let wrapper = document.querySelector('.messages-wrapper .scroller')
    while (wrapper.firstChild) {
        wrapper.removeChild(wrapper.firstChild)
    }
}

function populateMessages(channel = 'motd', useHtml = false) {
    let messages = getMessages(channel);
    currentChannel = channel;
    removePreviousMessages()
    for (i in messages) {
        let uname = messages[i].username
        let txt = messages[i].messageText
        let time = new Date(messages[i].timestamp)
        let timestamp = "" + time.getHours() + ":" + time.getMinutes() + ":" + time.getSeconds()
        sendMessage(uname, useHtml ? linkifyHtm(txt) : linkifyStr(txt), timestamp, channel == 'motd' ? true : false)
    }
}

function removePreviousUsers() {
    let wrapper = document.querySelector('.users-wrapper .scroller')
    while (wrapper.firstChild) {
        wrapper.removeChild(wrapper.firstChild)
    }
}

function populateNicknames(nicks, server) {
    //console.log(nicks, server)
    if (nicks == undefined) return;
    if (!server) {
        removePreviousUsers()
        for (i in nicks) {
            let q = document.querySelector(".users-wrapper .scroller");
            let temp = document.createElement("div");
            temp.className = "user";
            q.appendChild(temp);
            ReactDOM.render(React.createElement(IrcUser, {
                username: i,
                server: currentServer
            }), temp);
        }
    } else {
        if (document.querySelector(".users-wrapper .scroller ." + (server.replace(/\./g, "")))) removePreviousUsers()
        let q = document.querySelector(".users-wrapper .scroller");
        let tempSname = document.createElement("div")
        tempSname.innerHTML = server;
        tempSname.className = server.replace(/\./g, "");
        q.appendChild(tempSname);
        for (i in nicks) {
            let temp = document.createElement("div");
            temp.className = "user";
            q.appendChild(temp);
            ReactDOM.render(React.createElement(IrcUser, {
                username: i,
                server: server
            }), temp);
        }
    }
}

function pushMessage(from, to, message) {
    let namereg = new RegExp("\\b" + `(${config.username ? config.username : "irfusion"})` + "\\b","gi");
    //console.log(message, namereg.test(message), namereg)
    if (to == clientObject[currentServer].nick) {
        if(namereg.test(message) && currentChannel != from && from != 'System') {
            sendNotification(`${from} mentioned you`)
        }
        if (!channelObject[from]) channelObject[from] = {}
        if (!channelObject[from].messages) channelObject[from].messages = []
        let isAdded = false;
        for (i in registeredChannels) {
            //console.log(i,registeredChannels[i])
            if (from == registeredChannels[i]) {
                isAdded = true;
            }
        }
        let now = new Date().getTime()
        channelObject[from].messages.push({
            username: from,
            messageText: message,
            timestamp: now
        })
        if (!isAdded) {
            addChannel(from);
            registeredChannels.push(from);
        } else {
            //console.log(currentChannel, currentChannel == from);
            if (currentChannel == from) {
                //console.log( "should repopulate ")
                if (currentChannel == 'motd') {
                    populateMessages(from)
                } else {
                    populateMessages(from, true)
                }
                moveDivToBottom(document.querySelector(".messages-wrapper .scroller"))
            }
        }
    } else {
        if(namereg.test(message) && (currentChannel !== to || !document.hasFocus()) && from !== 'System') {
            //console.log("should send notif")
            sendNotification(`${from} mentioned you in ${to}`)
        }
        //sendNotification(`${from} mentioned you in ${to}`)
        if (!channelObject[to]) channelObject[to] = {}
        if (!channelObject[to].messages) channelObject[to].messages = []
        //console.log(from,to,message);
        let now = new Date().getTime()
        channelObject[to].messages.push({
            username: from,
            messageText: message,
            timestamp: now
        })
        if (currentChannel == to) {
            if (currentChannel == 'motd') {
                populateMessages(to)
            } else {
                populateMessages(to, true)
            }
            moveDivToBottom(document.querySelector(".messages-wrapper .scroller"))
        }
    }
}

function registerAndAddChannel(channelName = '') {
    if (channelName == '') return;
    if (!channelName.startsWith("#")) channelName = "#" + channelName;
    if (currentChannel == '') currentChannel = channelName;
    if (!channelObject[channelName]) channelObject[channelName] = {}
    if (!channelObject[channelName].messages) channelObject[channelName].messages = []
    //TODO register and listen to IRC channel
    let isListened = false;
    for (i in registeredChannels) {
        if (registeredChannels[i] == channelName) isListened = true;
    }
    if (!isListened) {
        for (key in clientObject) {
            clientObject[key].join(channelName);
        }
        registeredChannels.push(channelName);
    }
    addChannel(channelName);
}

function registerInput(name, size, node, callback = function (e) {
    if (e.which == 13 && !e.shiftKey) {
        let text = $(this).val()
        defaultMessageCallback(text)
        $(this).val("")
        e.preventDefault();
        return false;
    }
}) {
    let temp = document.createElement('div')
    temp.className = name
    node.appendChild(temp)
    ReactDOM.render(React.createElement(IrcInput, {
        name: name,
        size: size
    }), temp);
    $(temp.firstChild).keypress(callback);
}

function nicknameCallback(e) {
    let reg = /^[a-z][a-z0-9.-]{0,32}$/i;
    if (e.which == 13) {
        let text = $(this).val()
        //
        if (reg.test(text)) {
            //
            for (key in clientObject) {
                clientObject[key].send("NICK", text)
            }
            //client.say(currentChannel, `/nick ${text}`)
        } else {
            alert("Incorrectly formatted nickname.")
        }
        //
        $(this).val("")
        e.preventDefault();
        return false;
    }
}

function messageCallback(e) {
    if (e.which == 13 && !e.shiftKey) {
        let text = $(this).val()
        //
        if (text.startsWith("/")) {
            commandHandler(text.split(" ")[0].substr(1, text.split(" ")[0].length).toUpperCase(), text.substr(text.split(" ")[0].length + 1, text.length))
        } else {
            clientObject[currentServer].say(currentChannel, text);
        }
        //
        $(this).val("")
        e.preventDefault();
        return false;
    }
}

function channelCallback(e) {
    let reg = /([#&][^\x07\x2C\s]{0,200})/i;
    if (e.which == 13) {
        let text = $(this).val()
        //
        if (!text.startsWith("#")) text = "#" + text
        //
        if (reg.test(text)) {
            registerAndAddChannel(text);
        } else {
            alert("incorrect channel name")
        }
        $(this).val("")
        e.preventDefault();
        return false;
    }
}

function commandHandler(command, args) {
    //console.log(command, args);
    switch(command) {
        case "NICK": {
            for (key in clientObject) {
            clientObject[key].send(command, args)
        }
        break;
    }
    case "JOIN": {
        registerAndAddChannel(args);
        break;
    }
    case "HELP": {
        clientObject[currentServer].send(command)
        break;
    }
    case "LEAVE":
    case "PART": {
        if(!args.startsWith("#")) args = "#" + args
        for(key in clientObject) {
            clientObject[key].send("PART", args)
        }
        removeChannel(args.split(" ")[0]);
        break;
    }
    default: {
        pushMessage("System", currentChannel, `Incorrect/Unknown Command -- ${command}`)
    }
    }
}

function removeLoadingScreen() {
    let wrapper = document.querySelector(".overlay-wrapper");
    while (wrapper.firstChild) {
        wrapper.removeChild(wrapper.firstChild)
    }
    wrapper.setAttribute("data", "disabled");
}

class IrcChannel extends React.Component {
    render() {
        return React.createElement(
            "button", {
                onClick: () => {
                    if (this.props.channelName != 'motd') {
                        populateMessages(this.props.channelName, true);
                        for (key in clientObject) {
                            //console.log(this.props.channelName != 'motd', key, channelObject[this.props.channelName][key].nicks)
                            populateNicknames(this.props.channelName != 'motd' && channelObject[this.props.channelName][key] ? channelObject[this.props.channelName][key].nicks : undefined, key);
                        }
                        moveDivToBottom(document.querySelector(".messages-wrapper .scroller"))
                    } else {
                        removePreviousUsers()
                        populateMessages(this.props.channelName);
                        moveDivToBottom(document.querySelector(".messages-wrapper .scroller"))
                    }
                }
            },
            this.props.channelName
        )
    }
}
class IrcMessage extends React.Component {
    render() {
        return React.createElement(
            'div', {
                className: "message-content",
                id: `${this.props.username}`
            },
            `[${this.props.timestamp}] `,
            `${this.props.username}: `,
            this.props.messageText
        )
    }
}
class IrcInput extends React.Component {
    render() {
        return React.createElement(
            "textarea", {
                name: `${this.props.name}`,
                cols: this.props.size.width,
                rows: this.props.size.height
            },

        )
    }
}
class IrcUser extends React.Component {
    render() {
        return React.createElement(
            "button", {
                onClick: () => {
                    clientObject[this.props.server].whois(this.props.username, (info) => {
                        let time = new Date();
                        let timestamp = "" + time.getHours() + ":" + time.getMinutes() + ":" + time.getSeconds()
                        pushMessage('System', currentChannel, `--- <span class="bold">User Info:</span>
                    <br> <span class="bold red">${info.nick}</span> (${info.user}@${info.host}) 
                    <br> realname: ${info.realname}
                    <br> channels: <span class="bold red"> ${info.channels} </span>
                    <br><br>
                    --- <span class="bold">Server Info:</span>
                    <br> ${info.server}
                    <br> ${info.serverinfo}`)
                    })

                }
            },
            this.props.username
        )
    }
}

//TODO channel adding function
for (ekey in clientObject) {
    //console.log(clientObject[ekey]);
    let tempClient = clientObject[ekey];
    tempClient.on('message', (from, to, message) => {
        pushMessage(from, to, `${message} [${tempClient.opt.server}]`);
    })
    tempClient.on('selfMessage', (to, text) => {
        pushMessage(tempClient.nick, to, `${text} [${tempClient.opt.server}]`)
    })
    tempClient.on('join', (channel, nick) => {
        //console.log(this)
        pushMessage('System', channel, `${nick} has joined ${channel} [${tempClient.opt.server}]`)
        if(currentChannel == channel) {
            for (key in clientObject) {
                            //console.log(this.props.channelName != 'motd', key, channelObject[this.props.channelName][key].nicks)
                            populateNicknames(channel != 'motd' && channelObject[channel][key] ? channelObject[channel][key].nicks : undefined, key);
                        }
        }
    })
    tempClient.on('part', (channel, nick, reason) => {
        pushMessage('System', channel, `${nick} has left ${channel} - "${reason}" [${tempClient.opt.server}]`)
        if(currentChannel == channel) {
            for (key in clientObject) {
                            //console.log(this.props.channelName != 'motd', key, channelObject[this.props.channelName][key].nicks)
                            populateNicknames(channel != 'motd' && channelObject[channel][key] ? channelObject[channel][key].nicks : undefined, key);
                        }
        }
    })
    tempClient.on('quit', (nick, reason, channels) => {
        for (i in channels) {
            pushMessage('System', channels[i], `${nick} has left ${channels[i]} - "${reason}" [${tempClient.opt.server}]`)
            if(currentChannel == channels[i]) {
            for (key in clientObject) {
                            //console.log(this.props.channelName != 'motd', key, channelObject[this.props.channelName][key].nicks)
                            populateNicknames(channels[i] != 'motd' && channelObject[channels[i]][key] ? channelObject[channels[i]][key].nicks : undefined, key);
                        }
        }
        }
    })
    tempClient.on('kick', (channel, nick, by, reason) => {
        pushMessage('System', channel, `${nick} has been kicked from ${channel} by ${by} for reason "${reason}" [${tempClient.opt.server}]`)
        if(currentChannel == channel) {
            for (key in clientObject) {
                            //console.log(this.props.channelName != 'motd', key, channelObject[this.props.channelName][key].nicks)
                            populateNicknames(channel != 'motd' && channelObject[channel][key] ? channelObject[channel][key].nicks : undefined, key);
                        }
        }
    })
    tempClient.on('motd', (motd) => {
        pushMessage('System', 'motd', motd);
    })
    tempClient.on('topic', (channel, topic, nick) => {
        if (nick) {
            pushMessage('System', channel, `${nick} has changed the topic to "${topic}" [${tempClient.opt.server}]`)
        } else {
            pushMessage('System', channel, `${topic}`)
        }
    })
    tempClient.on('error', (e) => {
        console.log(e);
        pushMessage('System', currentChannel, `error: ${e.command} [${tempClient.opt.server}]`);
    })
    tempClient.on('nick', (oldnick, newnick, channels, message) => {
        for (chani in channels) {
            pushMessage('System', channels[chani], `User ${oldnick} has changed their nickname to ${newnick} [${tempClient.opt.server}]`)
            //console.log(chani + channels[chani])
            if (channels[chani] == currentChannel) {
                populateNicknames(channelObject[channels[chani]][tempClient.opt.server].nicks, tempClient.opt.server)
            }
        }
    })
    tempClient.on('names', (channel, nicks) => {
        if (!channelObject[channel]) channelObject[channel] = {}
        if (!channelObject[channel][tempClient.opt.server]) channelObject[channel][tempClient.opt.server] = {}
        channelObject[channel][tempClient.opt.server].nicks = nicks;
        //console.log(channelObject[channel].nicks)
        if (channel == currentChannel) {
            populateNicknames(channelObject[channel][tempClient.opt.server].nicks, tempClient.opt.server);
        }
    })
}
clientObject[currentServer].on('registered', () => {
    for (i in clientObject[ekey].chans) {
        registerAndAddChannel(clientObject[ekey].chans[i])
    }
    addChannel('motd')
    //registerAndAddChannel("testing")
    //registerAndAddChannel("testing-2")
    for (i in config.defaultChannels) {
        registerAndAddChannel(config.defaultChannels[i])
    }

    registerInput('nickname', {
        width: 32,
        height: 1
    }, document.querySelector('.settings-wrapper .username'), nicknameCallback)
    //registerInput('nickname-s','submit',document.querySelector('.settings-wrapper .username'))

    registerInput('channel-add', {
        width: 32,
        height: 1
    }, document.querySelector('.settings-wrapper .channel-add'), channelCallback)
    //registerInput('channel-add-s','submit',document.querySelector('.settings-wrapper .channel-add'))

    registerInput('message-input', {
        width: 128,
        height: 4
    }, document.querySelector('.message-input-wrapper .message-form'), messageCallback)
    //registerInput('message-input-s', 'submit', document.querySelector('.message-input-wrapper .message-form'))

    //
    removeLoadingScreen();
})