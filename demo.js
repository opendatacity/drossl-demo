#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var colors = require('colors');
var express = require('express');
var logstream = require('logstream').LogStream;
var config = require(path.resolve(__dirname, "config.js"));

/* load data */
var data = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'data/data.json')));

/* session management */
var sess = {
	generate: function(){
		return crypto.createHash('sha1').update([
			((new Date()).valueOf().toString()),
			(Math.random().toString())
		].join('-')).digest('hex');
	},
	get: function(req){
		if (!("session" in req.signedCookies) || !("sessid" in req.signedCookies.session)) {
			req.session.sessid = sess.generate();
			l(["session", req.session.sessid, req.ip, req.ips.join(' ')]);
			console.log("NEW SESSION".yellow.inverse.bold, (req.session.sessid).white);
			return req.session.id;
		} else {
			req.session.sessid = req.signedCookies.session.sessid;
			if (data.sessions.indexOf(req.signedCookies.session.sessid) < 0) {
				/* this is a new session and therefore increments count */
				data.sessions.push(req.signedCookies.session.sessid);
				data.site.count.protesters_total++;
			}
			data.last_request[req.signedCookies.session.sessid] = (new Date()).getTime();
			return req.signedCookies.session.sessid;
		}
	},
	cleanuptimer: null,
	cleanup: function(cb){
		/* clean sessions */
		var sessions = [];
		var last_request = {};
		var last_post = {};
		
		var timeout = ((new Date()).getTime() - 600000); // 10 minutes ago
		data.sessions.forEach(function(session){
			if ((session in data.last_request) && data.last_request[session] > timeout) {
				sessions.push(session);
				last_request[session] = data.last_request[session];
			}
		});

		timeout -= 590000; // 1 minute ago
		for (var session in data.last_post) {
			if (data.last_post[session] > timeout) {
				last_post[session] = data.last_post[session];
			}
		}
		
		/* update data */
		data.sessions = sessions;
		data.last_request = last_request;
		data.last_post = last_post;
		data.site.count.protesters = sessions.length;
		
		/* backup data */
		fs.writeFile(path.resolve(__dirname, "data/data.json"), JSON.stringify(data), function(err){
			if (!err) l(["save", "ok", "saved data backup"]);
			if (err) l(["save", "error", err.toString()]);
			
			/* callback? */
			if (typeof cb === "function") cb();
			
		});
		
	},
}

sess.cleanuptimer = setInterval(function(){
	sess.cleanup();
},60000);

var updatetimer = setInterval(function(){

	/* update site slogans */
	if (data.queue.slogans.length > 0) data.site.slogans.push(data.queue.slogans.unshift());
	if (data.site.slogans.length > 4) data.site.slogans.unshift();
	
},10000);

var exiting = false;
var exit = function(){
	try {
		if (exiting) return;
		exiting = true;
		console.log('Exiting');
		sess.cleanup(function(){
			process.exit();
		});
	} catch(e){};
}

process.on('exit', function(){
	exit();
});
process.on('SIGINT', function(){
	exit();
});

/* log file setup */
var log = new logstream(path.resolve(__dirname, config.logfile));
var l = function(msg) {
	if (typeof msg === "object") msg = msg.join('\t');
	log.write(((new Date()).getTime()).toString()+'\t'+msg+'\n');
}

/* express app setup */
var app = express();

app.configure(function(){
	app.set("trust proxy", true);
	app.use("/assets", express.static(path.resolve(__dirname, 'assets')));
	app.use(express.bodyParser());
	app.use(express.cookieParser(config.secret));
	app.use(express.cookieSession({
		"key": "session",
		"secret": config.secret
	}));
});

app.get('/api/data.json', function(req, res){
	var sessionid = sess.get(req);
	res.json(data.site);
});

app.post('/api/post.json', function(req, res){
	var sessionid = sess.get(req);
	
	if (!("slogan" in req.body) || typeof req.body['slogan'] !== "string" || req.body['slogan'] === "") {
		res.json({error: "Du musst Dir einen Spruch ausdenken."});
		return;
	}
	
	/* fix slogan */
	var slogan = req.body['slogan'].replace(/[^ -~\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u017F]/gi, ''); // printable ascii plus bunch-o-diacrits
	
	/* check length */
	if (slogan.length > 60) {
		res.json({error: "Der Spruch ist zu lang und passt nicht aufs Schild."});
		return;
	}
	
	/* check for flooding */
	if ((sessionid in data.last_post) && data.last_post[sessionid] > ((new Date()).getTime()+15000)) {
		res.json({error: "Nicht so viele Sprüche auf einmal."});
		return;
	}
	
	if (data.queue.slogans.indexOf(slogan) >= 0) {
		res.json({error: "Dieser Spruch ist bereits in der Warteschlange."});
		return;
	}
	
	/* FIXME: filter here if needed */
	
	/* to the queue */
	data.last_post[sessionid] = (new Date()).getTime();
	data.queue.slogans.push(slogan);
	
	l(["slogan", req.session.id, req.ip, req.ips.join(' '), slogan]);
	res.json({ok: "Dein Spruch ist in der Warteschlange"});
	
});

app.get('*', function(req, res){
	res.send('');
});

app.listen(config.port, config.host);
console.log("READY".green.inverse.bold, (config.host+':'+config.port).white);