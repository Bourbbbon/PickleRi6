//---------------------------------------------------------------------
// Files
// Contains functions for file management.
//---------------------------------------------------------------------

const Files = {};

Files.DBM = null;

Files.data = {};
Files.writers = {};
Files.crypto = require('crypto');
Files.dataFiles = [
	'commands.json',
	'events.json',
	'settings.json',
	'players.json',
	'servers.json',
	'serverVars.json',
	'globalVars.json'
];

Files.initStandalone = function() {
	const {Actions, Bot} = this.DBM;
	const fs = require('fs');
	const path = require('path');
	Actions.location = path.join(__dirname, '..', 'actions');
	if(fs.existsSync(Actions.location)) {
		Actions.initMods();
		this.readData(Bot.init.bind(Bot));
	} else {
		console.error('Please copy the "Actions" folder from the Discord Bot Maker directory to this bot\'s directory: \n' + this.DBM.Actions.location);
	}
};

Files.initBotTest = function(content) {
	const {Actions, Bot} = this.DBM;
	if(content) {
		Actions.location = String(content);
		Actions.initMods();
		this.readData(Bot.init.bind(Bot));

		const _console_log = console.log;
		console.log = function() {
			process.send(String(arguments[0]));
			_console_log.apply(this, arguments);
		};

		const _console_error = console.error;
		console.error = function() {
			process.send(String(arguments[0]));
			_console_error.apply(this, arguments);
		};
	}
};

Files.readData = function(callback) {
	const fs = require('fs');
	const path = require('path');
	let max = this.dataFiles.length;
	let cur = 0;
	for(let i = 0; i < max; i++) {
		const filePath = path.join(__dirname, '..', 'data', this.dataFiles[i]);
		if(!fs.existsSync(filePath)) continue;
		fs.readFile(filePath, function(error, content) {
			const filename = this.dataFiles[i].slice(0, -5);
			let data;
			try {
				if(typeof content !== 'string' && content.toString) content = content.toString();
				data = JSON.parse(this.decrypt(content));
			} catch(e) {
				console.error(`There was issue parsing ${this.dataFiles[i]}!`);
				return;
			}
			this.data[filename] = data;
			if(++cur === max) {
				callback();
			}
		}.bind(this));
	}
};

Files.saveData = function(file, callback) {
	const fs = require('fs');
	const path = require('path');
	const data = this.data[file];
	if(!this.writers[file]) {
		const fstorm = require('fstorm');
		this.writers[file] = fstorm(path.join(__dirname, '..', 'data', file + '.json'))
	}
	this.writers[file].write(this.encrypt(JSON.stringify(data)), function() {
		if(callback) {
			callback();
		}
	}.bind(this));
};

Files.initEncryption = function() {
	try {
		this.password = require('discord-bot-maker');
	} catch(e) {
		this.password = '';
	}
};

Files.encrypt = function(text) {
	if(this.password.length === 0) return text;
	const cipher = this.crypto.createCipher('aes-128-ofb', this.password);
	let crypted = cipher.update(text, 'utf8', 'hex');
	crypted += cipher.final('hex');
	return crypted;
};

Files.decrypt = function(text) {
	if(this.password.length === 0) return text;
	const decipher = this.crypto.createDecipher('aes-128-ofb', this.password);
	let dec = decipher.update(text, 'hex', 'utf8');
	dec += decipher.final('utf8');
	return dec;
};

Files.saveServerVariable = function(serverID, varName, item) {
	if(!this.data.serverVars[serverID]) {
		this.data.serverVars[serverID] = {};
	}
	if(typeof item !== 'object') {
		let result = '';
		try {
			result = JSON.stringify(item);
		} catch(e) {}
		if(result !== '{}') {
			this.data.serverVars[serverID][varName] = item;
		}
	} else if(item.convertToString) {
		this.data.serverVars[serverID][varName] = item.convertToString();
	}
	this.saveData('serverVars');
};

Files.restoreServerVariables = function() {
	const keys = Object.keys(this.data.serverVars);
	for(let i = 0; i < keys.length; i++) {
		const varNames = Object.keys(this.data.serverVars[keys[i]]);
		for(let j = 0; j < varNames.length; j++) {
			this.restoreVariable(this.data.serverVars[keys[i]][varNames[j]], 2, varNames[j], keys[i]);
		}
	}
};

Files.saveGlobalVariable = function(varName, item) {
	if(typeof item !== 'object') {
		let result = '';
		try {
			result = JSON.stringify(item);
		} catch(e) {}
		if(result !== '{}') {
			this.data.globalVars[varName] = item;
		}
	} else if(item.convertToString) {
		this.data.globalVars[varName] = item.convertToString();
	}
	this.saveData('globalVars');
};

Files.restoreGlobalVariables = function() {
	const keys = Object.keys(this.data.globalVars);
	for(let i = 0; i < keys.length; i++) {
		this.restoreVariable(this.data.globalVars[keys[i]], 3, keys[i]);
	}
};

Files.restoreVariable = function(value, type, varName, serverId) {
	const bot = this.DBM.Bot.bot;
	let cache = {};
	if(serverId) {
		cache.server = {
			id: serverId
		};
	}
	if(typeof value === 'string') {
		let finalValue = value;
		if(value.startsWith('mem-')) {
			finalValue = this.restoreMember(value, bot);
		} else if(value.startsWith('msg-')) {
			this.restoreMessage(value, bot).then(function(msg) {
				this.DBM.Actions.storeValue(msg, type, varName, cache);
			}.bind(this));
		} else if(value.startsWith('tc-')) {
			finalValue = this.restoreTextChannel(value, bot);
		} else if(value.startsWith('vc-')) {
			finalValue = this.restoreVoiceChannel(value, bot);
		} else if(value.startsWith('r-')) {
			finalValue = this.restoreRole(value, bot);
		} else if(value.startsWith('s-')) {
			finalValue = this.restoreServer(value, bot);
		} else if(value.startsWith('e-')) {
			finalValue = this.restoreEmoji(value, bot);
		} else if(value.startsWith('usr-')) {
			finalValue = this.restoreUser(value, bot);
		}
		this.DBM.Actions.storeValue(finalValue, type, varName, cache);
	} else {
		this.DBM.Actions.storeValue(value, type, varName, cache);
	}
};

Files.restoreMember = function(value, bot) {
	const split = value.split('_');
	const memId = split[0].slice(4);
	const serverId = split[1].slice(2);
	const server = bot.guilds.get(serverId);
	if(server && server.members) {
		const member = server.members.get(memId);
		return member;
	}
};

Files.restoreMessage = function(value, bot) {
	const split = value.split('_');
	const msgId = split[0].slice(4);
	const channelId = split[1].slice(2);
	const channel = bot.channels.get(channelId);
	if(channel && channel.fetchMessage) {
		return channel.fetchMessage(msgId);
	}
};

Files.restoreTextChannel = function(value, bot) {
	const channelId = value.slice(3);
	const channel = bot.channels.get(channelId);
	return channel;
};

Files.restoreVoiceChannel = function(value, bot) {
	const channelId = value.slice(3);
	const channel = bot.channels.get(channelId);
	return channel;
};

Files.restoreRole = function(value, bot) {
	const split = value.split('_');
	const roleId = split[0].slice(2);
	const serverId = split[1].slice(2);
	const server = bot.guilds.get(serverId);
	if(server && server.roles) {
		const role = server.roles.get(roleId);
		return role;
	}
};

Files.restoreServer = function(value, bot) {
	const serverId = value.slice(2);
	const server = bot.guilds.get(serverId);
	return server;
};

Files.restoreEmoji = function(value, bot) {
	const emojiId = value.slice(2);
	const emoji = bot.emojis.get(emojiId);
	return emoji;
};

Files.restoreUser = function(value, bot) {
	const userId = value.slice(4);
	const user = bot.users.get(userId);
	return user;
};

Files.initEncryption();

module.exports = Files;