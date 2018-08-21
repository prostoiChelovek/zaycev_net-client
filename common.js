"use strict"
var gui = require('nw.gui');
var Xray = require('x-ray');
var path = require("path")
var fs = require("fs")
var req = require("request")
var x = Xray();

var __dirname = path.resolve();
var cfg = {}

const loadConfig = () => {
	if(!fs.existsSync("config.json")){
		return
	}
	cfg = JSON.parse(fs.readFileSync("config.json", "utf8"))
}
loadConfig()

var tray = new gui.Tray({
	icon: 'img/icon.jpg'
})
var win = gui.Window.get()
window.moveTo(window.screen.width, 0)

var menu = new nw.Menu();
var m_visibility_btn = new nw.MenuItem({
	label: 'Hide',
	click: function () {
		if (this.label == "Hide") {
			win.hide()
			m_visibility_btn.label = "Show"
			tray.menu = menu
		} else {
			win.show()
			m_visibility_btn.label = "Hide"
			tray.menu = menu
			window.moveTo(window.screen.width, 0)
		}
	}
})
menu.append(m_visibility_btn);

var m_close_btn = new nw.MenuItem({
	label: 'Exit',
	click: function () {
		win.close()
	}
})
menu.append(m_close_btn);

var m_pb_btn = new nw.MenuItem({
	label: 'Play',
	click: function () {
		if(!audioElement)return
		if (audioElement.paused){
			audioElement.play()
		}else{
			audioElement.pause()
		}	
	}
})
menu.append(m_pb_btn);

var m_nexxt_btn = new nw.MenuItem({
	label: 'Next',
	click: function () {
		nextTrack()
	}
})
menu.append(m_nexxt_btn);

var m_prev_btn = new nw.MenuItem({
	label: 'Prev',
	click: function () {
		prevTrack()
	}
})
menu.append(m_prev_btn);

tray.menu = menu;

win.on('minimize', function () {
	this.hide();
});

var musicDir = cfg["musicDir"] || "./ZAYCEV"

if (!fs.existsSync(musicDir)) {
	fs.mkdirSync(musicDir)
}

const getZaycevTrackUrl = (trackUrl, callback) => {
	req({
			url: "http://zaycev.net" + trackUrl,
			json: true
		},
		(err, response, body) => {
			if (err) {
				console.log("Failed to load " + trackUrl + " with error " + err)
				return
			}
			callback(body.url)
		})
}

const downloadTrack = (url, artist, name) => {
	if (fs.existsSync(musicDir + "/" + artist + "/" + name + ".mp3")) return
	if (!fs.existsSync(musicDir + "/" + artist)) {
		fs.mkdirSync(musicDir + "/" + artist)
	}
	req
		.get(url)
		.on('error', function (err) {
			console.log("Failed to load " + url + " with error " + err)
		})
		.on("end",() => {
			var el = document.querySelector('[audio="'+ url + '"]')
			if(el){
				el.setAttribute("audio", "file://" + __dirname + "/" + musicDir + "/" + artist + "/" + name + ".mp3")
				tracks[el.getAttribute("audio")] = tracks[url];
				delete tracks[url]
			}
		})
		.pipe(fs.createWriteStream(musicDir + "/" + artist + "/" + name + ".mp3"))
}

const nextTrack = () => {
	var n = Number(audioElement.getAttribute("t_id")) + 1
	var next = document.querySelector('[t_id="' + n + '"]')
	if(next){
		playTrack(next)
	}
}

const prevTrack = () => {
	var n = Number(audioElement.getAttribute("t_id")) - 1
	var prev = document.querySelector('[t_id="' + n + '"]')
	if(prev){
		playTrack(prev)
	}
}

const playTrack = el => {
	var c = document.getElementById("track-selected")
	if(c)
		c.removeAttribute("id")
	el.setAttribute("id", "track-selected")
	var trackOffest = el.offsetY
	if(window.pageYOffset < trackOffest){
		window.scrollY(trackOffest)
	}
	var U = el.getAttribute("audio")
	downloadTrack(U, tracks[U][1], tracks[U][0])
	if (audioElement && !audioElement.paused)
		audioElement.pause()
	audioElement.src = U
	audioElement.setAttribute("t_id", el.getAttribute("t_id"))
	audioElement.play()
}

const timeFormat = time => {
	var minutes = Math.floor(time / 60).toFixed(0);
	var seconds = (time - minutes * 60).toFixed(0);
	if(Number(minutes) < 10){
		minutes = "0"+minutes
	}
	if(Number(seconds) < 10){
		seconds = "0"+seconds
	}
	return minutes + ":" + seconds
}

var currentArtist
var tracks = {}
var tracksContainer = document.getElementById("tracks")
var audioElement = document.getElementById("audioPlayer")
var timeControl = document.getElementById("time-control")
var pbControl = document.getElementById("pbControl-btn")
var searchBtn = document.getElementById("search-btn")
var currentTimeP = document.getElementById("currentTime")
var queryInput = document.getElementById("query")

var i = 0
const parseZaycev = query => {
	query = encodeURIComponent(query.replace(" ", "+"))
	x("http://zaycev.net/search.html?query_search=" + query, ".musicset-track", [{
			name: ".musicset-track__track-name",
			artist: ".musicset-track__artist a",
			duration: ".musicset-track__duration",
			dataUrl: "@data-url"
		}])
		.paginate(".pager__item@href")
		.limit(2)
		.then(data => {
			data.forEach(t => {
				if (t.artist) {
					getZaycevTrackUrl(t.dataUrl, url => {
						var trackEl = document.createElement("div")
						trackEl.className = "track"
						trackEl.onclick = e => playTrack(e.target)
						trackEl.setAttribute("t_id", i)
						if (fs.existsSync(musicDir + "/" + t.artist + "/" + t.name + ".mp3")){
							url = "file://" + __dirname + "/" + musicDir + "/" + t.artist + "/" + t.name + ".mp3"
						}
						trackEl.setAttribute("audio", url)
						i++
						var trackName = document.createElement("p")
						trackName.className = "name"
						trackName.innerHTML = t.name
						var trackDuration = document.createElement("p")
						trackDuration.className = "duration"
						trackDuration.innerHTML = t.duration
						trackEl.appendChild(trackName)
						trackEl.appendChild(trackDuration)
						tracksContainer.appendChild(trackEl)
						currentArtist = t.artist
						tracks[url] = [t.name.trim(), t.artist]
					})
				}
			});
		})
}


searchBtn.onclick = () => {
	var q = queryInput.value
	if(q.trim() != ""){
		while (tracksContainer.firstChild) {
			tracksContainer.removeChild(tracksContainer.firstChild);
		}
		parseZaycev(q)
	}
}

queryInput.onkeypress = e => {
	if(e.key == "Enter")
		searchBtn.onclick()
}

var timeChanged = false
timeControl.addEventListener("change", el => {
	if(audioElement.src != "" && audioElement.getAttribute("t_id")){
		audioElement.currentTime = audioElement.duration / 100 * el.target.value
		timeChanged = true
	}
})

pbControl.addEventListener("click", () => {
	if(!audioElement)return
	if (audioElement.paused){
		audioElement.play()
	}else{
		audioElement.pause()
	}	
})

audioElement.onended = () => {
	nextTrack()
}

audioElement.onplay = () => {
	pbControl.firstChild.className = "fa fa-pause"
	m_pb_btn.label = "Pause"
	tray.menu = menu
}

audioElement.onpause = () => {
	pbControl.firstChild.className = "fa fa-play"
	m_pb_btn.label = "Play"
	tray.menu = menu
}

audioElement.ontimeupdate = () => {
	currentTimeP.innerHTML = timeFormat(audioElement.currentTime)
	if(!timeChanged)
		timeControl.value = audioElement.currentTime / (audioElement.duration / 100)
	else
		timeChanged = false
}