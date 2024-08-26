export class classicAppState{guesses=[];rendered=[];getUserID(){return JSON.parse(window.localStorage.getItem("userID"))}setUserID(e){window.localStorage.setItem("userID",JSON.stringify(e))}getGameID(){return JSON.parse(window.localStorage.getItem("gameID"))}setGameID(e){window.localStorage.setItem("gameID",JSON.stringify(e))}getTries(){return this.refreshState(),this.guesses.length}notRendered(){return 0==this.rendered.length}refreshState(){var e=JSON.parse(window.localStorage.getItem("state"));null!=e?this.guesses=e:this.guesses=[]}removeState(){window.localStorage.removeItem("state")}addGuess(e){this.refreshState(),this.guesses.unshift(e),window.localStorage.setItem("state",JSON.stringify(this.guesses)),this.renderGuess(this.guesses[0])}renderGuess(e){var s=e[0],t=e[1],r=document.getElementById("answers-container"),a=document.createElement("DIV");for(var l in a.setAttribute("class","answers"),a.innerHTML=`<img alt="" aria-label="${s.name}" class="pokeimage" src='/public/images/sprites/${s.name}.webp'>`,t){var i=document.createElement("DIV");switch(i.setAttribute("class",t[l]),l){case"habitat":i.innerHTML=`<img alt="" aria-label="${s[l]}" class="habitat" src="/public/images/habitats/${s[l]}.webp"/>`;break;case"colors":var n=s[l];i.innerHTML=null==n[1]?`<div class="color-square" style="background-color: ${n[0]}"></div>`:`<div class="color-square" style="background-color: ${n[0]}"></div><div class="color-square" style="background-color: ${n[1]}"></div>`;break;case"types":var c=s[l];i.innerHTML=null==c[1]?`<img alt="" aria-label="${c[0]}" class="types" src="/public/images/types/${c[0]}.webp"/>`:`<img alt="" aria-label="${c[0]}" class="types" src="/public/images/types/${c[0]}.webp"/><img alt="" aria-label="${c[1]}" class="types" src="/public/images/types/${c[1]}.webp"/>`;break;case"fullyEvolved":i.innerHTML=`<p class="answers-text">${s[l]?"Yes":"No"}</p>`;break;default:i.innerHTML=`<p class="answers-text">${s[l]}</p>`}a.appendChild(i)}r.insertAdjacentElement("afterbegin",a),this.rendered[this.rendered.length]=e}renderState(){this.refreshState();for(var e=this.guesses.length-1;e>=0;e--)this.renderGuess(this.guesses[e])}renderStateDiff(){this.refreshState();for(var e=this.guesses,s=0;s<this.rendered.length;s++){var t=e.findIndex(e=>e[0].name==this.rendered[s][0].name);t>=0&&e.splice(t,1)}for(var s=e.length-1;s>=0;s--)this.renderGuess(e[s])}}