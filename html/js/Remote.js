class Remote{
	constructor(){
		this.sock = new SocketHelper({
			url:document.location.host+'/webSocket?user=remote',
			onConnect:this.connected,
			scope:this
		});
		this.sock.connect();
	}

	connected(){

		//this.sock.send({to:'stream',action:'playerBanner',value:'Sirto|TSON|Cleod|ZI'});
		/*
		let test = "";
		for(let i = 0;i<10;i++) {
			test += ' TEST ';
			this.sock.send({to: 'stream', action: 'notification', text: 'Sirto'+(i+1)+' Just Followed!'+test,time:4000});
		}
		setTimeout(function(){
			this.sock.send({to:'stream',action:'play',value:'Menu (NES Mix).mp3'});
		}.bind(this),10000)
		*/

	}


	reloadMusicList(){
		Ajax.request({
			url:'/api/getMusic',
			success:function(reply){
				/*
				Ajax.request({
					url:'/api/setMusicQueue',
					params:{music:reply.music},
					success:function(reply){

					},
					scope:this
				});
				*/
			},
			scope:this
		});
	}
}
let r = new Remote();
r.reloadMusicList()

