/*
	Jake's MG Visualizer 2018 - MIT license.
*/

class MgVisualizer{
	constructor(websocketMode){

		this.websocketMode = websocketMode;
		this.sock = null;
		if(this.websocketMode){
			document.getElementById('infoBox').style.display = 'none';
			this.sock = new SocketHelper({
				url:document.location.host+'/webSocket?user=stream',
				onMessage:this.socketMessageReceived,
				scope:this
			});
			this.sock.connect();
		}

		this.audioCtx = null;

		this.musicSource = null;
		this.musicAnalyser = null;

		this.beatSource = null;
		this.beatAnalyser = null;

		this.currentBuffer = null;
		this.bufferLength = null;
		this.dataArray = null;
		this.lowPassDataArray = null;

		this.canvas = document.querySelector('.visualizer');
		this.canvasCtx = this.canvas.getContext("2d");
		//this.canvasCtx.fillStyle = 'rgb(0, 0, 0)';
		//this.canvasCtx.fillRect(0, 0, this.canvas.width,  this.canvas.height);

		this.overlayCanvas = document.querySelector('.overlay');
		this.overlayCtx = this.overlayCanvas.getContext("2d");
		//this.overlayCtx.fillStyle = 'rgb(0, 0, 0)';
		//this.overlayCtx.fillRect(0, 0, this.overlayCanvas.width,  this.overlayCanvas.height);

		this.ticker = new Ticker(this.overlayCanvas);
		this.fist = new Image();
		this.fist.src = 'img/fist.png';

		let points = [
			{x:678,y:290.8},
			{x:728.1,y:256.2},
			{x:742.3,y:309.4},
			{x:797.1,y:314.2},
			{x:773.8,y:364},
			{x:812.7,y:402.9},
			{x:762.9,y:426.1},
			{x:767.7,y:480.9},
			{x:714.5,y:466.7},
			{x:683,y:511.8},
			{x:651.5,y:466.7},
			{x:598.3,y:480.9},
			{x:603.1,y:426.1},
			{x:553.3,y:402.9},
			{x:592.2,y:364},
			{x:568.9,y:314.2},
			{x:623.7,y:309.4},
			{x:637.9,y:256.2},
			{x:688,y:290.8}
		];

		this.mgBorder = new PathDrawer({
			points:points,
			ctx:this.overlayCtx
		});
		this.mgBgBorder = new PathDrawer({
			points:points,
			ctx:this.canvasCtx
		});

		this.alreadyDrawing = false;

		this.stats = new Stats();
		//document.body.appendChild( this.stats.dom );

		this.audioCtx = new window.AudioContext();

		this.musicQueue = [];
		this.currentSong = 0;
		this.loadingSong = false;

		this.startTime = 0;
		this.pauseTime = 0;
		this.paused = false;
		this.flowIn = false;
		this.musicPlaying = false;

		this.mgColors = [
			{r:255,g:0,b:0},
			{r:255,g:255,b:0},
			{r:255,g:255,b:255}
		];

		this.rainbowColors = [
			{r:244,g:67,b:54}, //red
			{r:255,g:87,b:34}, //deep orange
			{r:255,g:152,b:0}, // orange
			{r:155,g:193,b:7}, //amber
			{r:255,g:255,b:59}, //yellow
			{r:139,g:195,b:74}, //light green
			{r:76,g:175,b:80}, //green
			{r:0,g:150,b:136}, //teal
			{r:33,g:150,b:243}, //Blue
			{r:63,g:81,b:181}, //Indigo
			{r:103,g:58,b:183}, //Deep Purple
			{r:156,g:39,b:176} //Purple
		];

		this.colors = this.mgColors;
		this.currentColor = 0;

		this.logoRotateDirection = 1;
		this.recentBeatPeaks = [];
		this.beatPeakCap = 1;

		let audioDom = document.getElementById('audio_file');
		audioDom.onchange = this.audioFileChange.bind(this);

		document.onkeypress = this.keypress.bind(this);

		this.logoRotation = Math.PI;
		this.logoRotationTween = new JakeTween({
			on:this,
			to:{logoRotation:Math.PI},
			time:2000,
			ease:JakeTween.easing.quadratic.out,
			neverDestroy:true
		});

		this.beatValSmoothed = 0;
		this.beatValTween = new JakeTween({
			on:this,
			to:{beatValSmoothed:0},
			time:50,
			ease:JakeTween.easing.linear,
			neverDestroy:true
		});

		this.notification = new StreamNotification(this.overlayCanvas);

		this.draw();
	}

	socketMessageReceived(message){
		switch(message.action) {
			case 'play':
				this.loadSongViaAjax(message.value);
				break;
			case 'notification':
				this.notification.displayNotification(message);
				break;
			default:
				console.error('Unknown action "'+message.action+'"');
				break;
		}
	}

	audioFileChange(event){
		//console.log(arguments);
		document.getElementById('infoBox').style.display = 'none';
		if(event.srcElement.files.length > 0){
			this.musicQueue = event.srcElement.files;
			this.currentSong = 0;
			this.loadSongFromBrowse(this.musicQueue[0]);
		}
	}

	keypress(event){
		switch(event.key){
			case 'p':
				this.pause();
				break;
			case 'f':
				this.canvasCtx.fillStyle = 'rgba(0, 0, 0, 1)';
				this.canvasCtx.fillRect(0,0,this.canvas.width,this.canvas.height);
				this.flowIn = !this.flowIn;
				break;
			case 'c':
				this.currentColor = 0;
				if(this.colors === this.mgColors){
					this.colors = this.rainbowColors;
				}else{
					this.colors = this.mgColors;
				}
				break;
		}
	};

	loadSongFromBrowse(file){
		this.loadingSong = true;
		let dot = file.name.lastIndexOf('.');
		if(dot !== -1){
			this.ticker.setSong(file.name.substring(0,dot));
		}else{
			this.ticker.setSong(file.name);
		}
		this.stop();
		let reader = new FileReader();
		reader.onload = function() {
			this.audioCtx.decodeAudioData(reader.result, function(newBuffer){
				this.currentBuffer = newBuffer;
				this.play();
				this.ticker.show();
			}.bind(this));
		}.bind(this);
		reader.readAsArrayBuffer(file);
	}

	loadSongViaAjax(url){

		let dot = url.lastIndexOf('.');
		if(dot !== -1){
			this.ticker.setSong(url.substring(0,dot));
		}else{
			this.ticker.setSong(url);
		}

		this.stop();
		let xhr = new XMLHttpRequest();
		xhr.responseType = 'arraybuffer';
		xhr.onreadystatechange = function(){
			if(xhr.readyState === XMLHttpRequest.DONE){
				if(xhr.status === 200){
					this.audioCtx.decodeAudioData(xhr.response, function(newBuffer){
						this.currentBuffer = newBuffer;
						this.play();
						this.ticker.show();
					}.bind(this));
				} else{
					alert('something else other than 200 was returned');
				}
			}
		}.bind(this);
		xhr.open("GET", "music/"+url, true);
		xhr.send();
	}

	play(){
		let offset = this.pauseTime;
		//beatContext = new window.AudioContext();
		this.beatSource = this.audioCtx.createBufferSource();
		this.beatSource.buffer = this.currentBuffer;
		this.beatSource.loop = false;
		let filter = this.audioCtx.createBiquadFilter();
		filter.type = "lowpass";
		this.beatSource.connect(filter);
		//filter.connect(beatContext.destination);
		this.beatAnalyser = this.audioCtx.createAnalyser();
		filter.connect(this.beatAnalyser);
		this.beatAnalyser.fftSize = 128; //must be power of 2
		//this.beatAnalyser.smoothingTimeConstant = 1;
		this.lowPassDataArray = new Uint8Array(this.beatAnalyser.frequencyBinCount);

		this.musicSource = this.audioCtx.createBufferSource();
		this.musicSource.connect(this.audioCtx.destination);
		this.musicSource.buffer = this.currentBuffer;
		this.musicSource.loop = false;
		this.musicAnalyser = this.audioCtx.createAnalyser();
		this.musicSource.connect(this.musicAnalyser);
		this.musicAnalyser.fftSize = 128; //must be power of 2
		this.musicAnalyser.smoothingTimeConstant = 1;
		this.bufferLength = this.musicAnalyser.frequencyBinCount;
		this.dataArray = new Uint8Array(this.bufferLength);

		this.musicSource.start(0,offset);
		this.beatSource.start(0,offset);
		this.startTime = this.audioCtx.currentTime - offset;
		this.pauseTime = 0;
		this.paused = false;
		this.loadingSong = false;

		this.musicSource.onended = function(){
			if(this.loadingSong){
				return;
			}
			this.currentSong++;
			if(this.currentSong >= this.musicQueue.length){
				//NO Playlist looping for now!
				//this.currentSong = 0;
			}else {
				this.loadSong(this.musicQueue[this.currentSong]);
			}
		}.bind(this);

		this.musicPlaying = true;
	}

	pause(){
		if(this.paused){
			this.play();
			this.paused = false;
			return;
		}
		let elapsed = this.audioCtx.currentTime - this.startTime;
		this.stop();
		this.pauseTime = elapsed;
		this.paused = true;
	}

	stop(){
		this.musicPlaying = false;
		this.paused = false;
		if(this.musicSource){
			this.musicSource.disconnect();
			this.musicSource.stop();
			this.musicSource = null;
			this.beatSource.disconnect();
			this.beatSource.stop();
			this.beatSource = null;
		}
		this.pauseTime = 0;
		this.startTime = 0;
	}

	draw(time) {
		this.stats.begin();
		this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
		JakeTween.update();
		this.ticker.draw();
		this.notification.draw();
		this.drawVisuals();
		requestAnimationFrame(this.draw.bind(this));
		this.stats.end();
	}

	drawVisuals(){
		if(this.paused || !this.musicPlaying){
			return;
		}

		this.musicAnalyser.getByteTimeDomainData(this.dataArray);
		this.beatAnalyser.getByteTimeDomainData(this.lowPassDataArray);

		//this.canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.03)';
		//this.canvasCtx.fillRect(0,0,canvas.width,canvas.height);

		let beatVal = Math.abs(this.lowPassDataArray[0]-128)/64;
		if(beatVal >= this.beatPeakCap && !this.recentBeatPeaks.includes(this.beatPeakCap)){
			this.logoRotateDirection *= -1;
			this.logoRotationTween.setConfig({to:{logoRotation:Math.PI*this.logoRotateDirection}}).start();
			beatVal = this.beatPeakCap;
			this.currentColor++;
			if(this.currentColor === this.colors.length){
				this.currentColor = 0;
			}
		}
		this.recentBeatPeaks.push(beatVal);
		if(this.recentBeatPeaks.length > 1){
			this.recentBeatPeaks.shift();
		}

		//Tone this down a bit for the logo bouncing.
		let logoBeatValSmoothed = this.beatValSmoothed/3;
		this.beatValTween.setConfig({to:{beatValSmoothed:beatVal}}).start();


		let r = Math.floor((this.colors[this.currentColor].r)*this.beatValSmoothed);
		let g = Math.floor((this.colors[this.currentColor].g)*this.beatValSmoothed);
		let b = Math.floor((this.colors[this.currentColor].b)*this.beatValSmoothed);

		let rgb = 'rgb('+r+','+g+','+b+')';

		//this.drawCircle(rgb,this.dataArray);

		this.canvasCtx.fillStyle = '#ffffff';

		let logoX = this.canvas.width/2;//Math.sin(rot)*200+canvas.height/2;
		let logoY = this.canvas.height/2;//Math.sin(rot)*200+canvas.height/2;

		this.mgBgBorder.setConfigs({
			drawX:logoX,
			drawY:logoY,
			scale:logoBeatValSmoothed+1,
			color:rgb,
			angle:this.logoRotation,
			fill:false
		}).draw();

		let fadeSpeed = Math.abs(this.beatValSmoothed)*30+5;
		//fadeSpeed = 15;
		if(this.flowIn){
			this.canvasCtx.drawImage(this.canvasCtx.canvas, 0, 0, this.canvas.width, this.canvas.height, fadeSpeed, fadeSpeed, this.canvas.width - fadeSpeed*2, this.canvas.height - fadeSpeed*2);
		}else{
			this.canvasCtx.drawImage(this.canvasCtx.canvas, 0, 0, this.canvas.width, this.canvas.height, -fadeSpeed, -fadeSpeed, this.canvas.width + fadeSpeed*2, this.canvas.height + fadeSpeed*2);
		}

		this.mgBorder.setConfigs({
			drawX:logoX,
			drawY:logoY,
			scale:logoBeatValSmoothed+1,
			color:'rgb(0,0,0)',
			angle:this.logoRotation,
			fill:true
		}).draw();
		this.mgBorder.setConfigs({
			color:'rgb(255,255,255)',
			fill:false
		}).draw();

		let logoWidth = 150*(logoBeatValSmoothed+1);
		let logoHeight = 140*(logoBeatValSmoothed+1);
		this.overlayCtx.drawImage(this.fist,this.canvas.width/2-logoWidth/2,this.canvas.height/2-logoHeight/2,logoWidth,logoHeight);
	}

	drawCircle(color,data){
		this.canvasCtx.strokeStyle = color;
		this.canvasCtx.lineWidth = 8;
		this.canvasCtx.beginPath();
		let circleRadius = 110;
		for(let i = 0; i < this.bufferLength; i++) {
			let spike = data[i] -128;
			let x = this.canvas.width/2 + Math.cos((Math.PI*2)*(i/this.bufferLength)+(Math.PI/2))*(circleRadius+spike);
			let y = this.canvas.height/2 + Math.sin((Math.PI*2)*(i/this.bufferLength)+(Math.PI/2))*(circleRadius+spike);
			if(i === 0) {
				this.canvasCtx.moveTo(x, y);
			} else {
				this.canvasCtx.lineTo(x, y);
			}
		}
		let firstSpike =  (data[0] -128);
		let lastX = this.canvas.width/2 + Math.cos(Math.PI/2)*(circleRadius+firstSpike);
		let lastY = this.canvas.height/2 + Math.sin(Math.PI/2)*(circleRadius+firstSpike);
		this.canvasCtx.lineTo(lastX, lastY);
		this.canvasCtx.stroke();
	}
}