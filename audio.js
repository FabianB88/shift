// Original quiz cues synthesized locally. No audio downloads or TV samples.
export class QuizAudio {
  constructor(){this.context=null;this.master=null;this.enabled=true;this.nodes=new Set();this.loop=null;this.tickKey='';this.roundKey='';}
  async unlock(){
    if(!this.enabled)return;
    try{this.context??=new(window.AudioContext||window.webkitAudioContext)();if(!this.master){this.master=this.context.createGain();this.master.gain.value=.42;this.master.connect(this.context.destination);}await this.context.resume();}catch{}
  }
  setEnabled(value){this.enabled=value;if(this.master)this.master.gain.value=value?.42:0;if(!value)this.stop();}
  note(freq,time,duration=.18,volume=.13,type='sine',end=null){
    if(!this.enabled||!this.context||this.context.state!=='running')return;
    const o=this.context.createOscillator(),g=this.context.createGain();o.type=type;o.frequency.setValueAtTime(freq,time);if(end)o.frequency.exponentialRampToValueAtTime(end,time+duration);
    g.gain.setValueAtTime(.0001,time);g.gain.exponentialRampToValueAtTime(volume,time+.008);g.gain.exponentialRampToValueAtTime(.0001,time+duration);o.connect(g);g.connect(this.master);this.nodes.add(o);o.onended=()=>{this.nodes.delete(o);o.disconnect();g.disconnect();};o.start(time);o.stop(time+duration+.015);
  }
  cue(kind){
    if(!this.enabled||!this.context||this.context.state!=='running')return;const t=this.context.currentTime;
    if(kind==='correct'){[523.25,659.25,1046.5].forEach((f,i)=>this.note(f,t+i*.06,.22,.13,'sine'));this.note(92,t,.15,.11,'sine',45);}
    if(kind==='wrong'){this.note(155,t,.18,.07,'triangle',110);this.note(116,t+.09,.2,.055,'triangle');}
    if(kind==='start'){[261.63,392,523.25,783.99].forEach((f,i)=>this.note(f,t+i*.11,.24,.09,'triangle'));this.note(75,t,.24,.12,'sine',40);}
    if(kind==='end'){this.note(98,t,.36,.13,'triangle',65);this.note(196,t+.06,.4,.07,'sine');}
    if(kind==='complete'){[392,523.25,659.25,783.99,1046.5].forEach((f,i)=>this.note(f,t+i*.1,.36,.11,'triangle'));}
    if(kind==='tick'){this.note(920,t,.045,.045);this.note(58,t,.1,.085,'sine',38);}
  }
  stage(active,key){
    if(!active||!this.enabled){this.stopLoop();return;}if(this.loop&&this.roundKey===key)return;this.stopLoop();this.roundKey=key;
    const pulse=()=>{if(document.hidden||!this.enabled)return;const t=this.context?.currentTime;if(t==null)return;this.note(65.41,t,.23,.028,'sine');this.note(98,t+.4,.2,.018,'sine');};
    pulse();this.loop=setInterval(pulse,2000);
  }
  countdown(key,seconds){if(key===this.tickKey)return;this.tickKey=key;if(seconds>0&&seconds<=10)this.cue('tick');}
  stopLoop(){clearInterval(this.loop);this.loop=null;}
  stop(){this.stopLoop();for(const node of this.nodes){try{node.stop();}catch{}}this.nodes.clear();}
}
