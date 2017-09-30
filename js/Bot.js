//---------------------------------------------------------------------
// Bot
// Contains functions for controlling the bot.
//---------------------------------------------------------------------

const Bot = {};

Bot.DBM = null;

const DiscordJS = require('discord.js');

Bot.$cmds = {}; // Normal commands
Bot.$icds = []; // Includes word commands
Bot.$regx = []; // Regular Expression commands
Bot.$anym = []; // Any message commands
Bot.$evts = {}; // Events

Bot.bot = null;

Bot.init = function() {
	this.initBot();
	this.reformatData();
	this.initEvents();
	this.login();
};

Bot.initBot = function() {
	this.bot = new DiscordJS.Client();
};

Bot.reformatData = function() {
	this.reformatCommands();
	this.reformatEvents();
};

Bot.reformatCommands = function() {
	const data = this.DBM.Files.data.commands;
	if(!data) return;
	this._caseSensitive = Boolean(this.DBM.Files.data.settings.case === 'true');
	for(let i = 0; i < data.length; i++) {
		const com = data[i];
		if(com) {
			switch(com.comType) {
				case '1':
					this.$icds.push(com);
					break;
				case '2':
					this.$regx.push(com);
					break;
				case '3':
					this.$anym.push(com);
					break;
				default:
					if(this._caseSensitive) {
						this.$cmds[com.name] = com;
					} else {
						this.$cmds[com.name.toLowerCase()] = com;
					}
					break;
			}
		}
	}
};

Bot.reformatEvents = function() {
	const data = this.DBM.Files.data.events;
	if(!data) return;
	for(let i = 0; i < data.length; i++) {
		const com = data[i];
		if(com) {
			const type = com['event-type'];
			if(!this.$evts[type]) this.$evts[type] = [];
			this.$evts[type].push(com);
		}
	}
};

Bot.initEvents = function() {
	this.bot.on('ready', this.onReady.bind(this));
	this.bot.on('message', this.onMessage.bind(this));
	this.DBM.Events.registerEvents(this.bot);
};

Bot.login = function() {
	this.bot.login(this.DBM.Files.data.settings.token);
};

Bot.onReady = function() {
	if(process.send) process.send('BotReady');
	console.log('Bot is ready!');
	this.restoreVariables();
	this.preformInitialization();
};

Bot.restoreVariables = function() {
	const Files = this.DBM.Files;
	Files.restoreServerVariables();
	Files.restoreGlobalVariables();
};

Bot.preformInitialization = function() {
	const bot = this.bot;
	if(this.$evts["1"]) {
		this.DBM.Events.onInitialization(bot);
	}
	if(this.$evts["3"]) {
		this.DBM.Events.setupIntervals(bot);
	}
};

Bot.onMessage = function(msg) {
	if(!msg.author.bot) {
		try {
			if(!this.checkCommand(msg)) {
				this.onAnyMessage(msg);
			}
		} catch(e) {
			console.error(e);
		}
	}
};

Bot.checkCommand = function(msg) {
	let command = this.checkTag(msg.content);
	if(command) {
		if(!this._caseSensitive) {
			command = command.toLowerCase();
		}
		const cmd = this.$cmds[command];
		if(cmd) {
			this.DBM.Actions.preformActions(msg, cmd);
			return true;
		}
	}
	return false;
};

Bot.checkTag = function(content) {
	const tag = this.DBM.Files.data.settings.tag;
	const separator = this.DBM.Files.data.settings.separator || '\\s+';
	content = content.split(new RegExp(separator))[0];
	if(content.startsWith(tag)) {
		return content.substring(tag.length);
	}
	return null;
};

Bot.onAnyMessage = function(msg) {
	this.checkIncludes(msg);
	this.checkRegExps(msg);
	if(!msg.author.bot) {
		if(this.$evts["2"]) {
			this.DBM.Events.callEvents("2", 1, 0, 2, false, '', msg);
		}
		const anym = this.$anym;
		for(let i = 0; i < anym.length; i++) {
			if(anym[i]) {
				this.DBM.Actions.preformActions(msg, anym[i]);
			}
		}
	}
};

Bot.checkIncludes = function(msg) {
	const text = msg.content;
	if(!text) return;
	const icds = this.$icds;
	for(let i = 0; i < icds.length; i++) {
		if(icds[i] && icds[i].name) {
			if(text.match(new RegExp('\\b' + icds[i].name + '\\b', 'i'))) {
				this.DBM.Actions.preformActions(msg, icds[i]);
			}
		}
	}
};

Bot.checkRegExps = function(msg) {
	const text = msg.content;
	if(!text) return;
	const regx = this.$regx;
	for(let i = 0; i < regx.length; i++) {
		if(regx[i] && regx[i].name) {
			if(text.match(new RegExp(regx[i].name, 'i'))) {
				this.DBM.Actions.preformActions(msg, regx[i]);
			}
		}
	}
};

module.exports = Bot;