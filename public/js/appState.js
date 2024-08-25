export class AppState{guesses=[];rendered=[];getID(){return JSON.parse(window.localStorage.getItem("userID"))}setID(e){window.localStorage.setItem("userID",JSON.stringify(e))}getGameID(){return JSON.parse(window.localStorage.getItem("gameID"))}setGameID(e){window.localStorage.setItem("gameID",JSON.stringify(e))}getTries(){return this.refreshState(),this.guesses.length}notRendered(){return 0==this.rendered.length}refreshState(){var e=JSON.parse(window.localStorage.getItem("state"));null!=e?this.guesses=e:this.guesses=[]}removeState(){window.localStorage.removeItem("state")}add(e){this.refreshState(),this.guesses.unshift(e),window.localStorage.setItem("state",JSON.stringify(this.guesses)),this.renderGuess(this.guesses[0])}renderGuess(e){var s=document.getElementById("answers-container"),t=document.createElement("DIV");for(var r in t.setAttribute("class","answers"),t.innerHTML=`<img alt="" aria-label="${e[0].name}" class="pokeimage" src='/public/images/sprites/${e[0].name}.webp'>`,e[1])if(Object.hasOwnProperty.call(e[1],r)&&!0!=e[1][r]&&!1!=e[1][r]){var a=document.createElement("DIV");switch(a.setAttribute("class",e[1][r]),r){case"habitat":a.innerHTML=`<img alt="" aria-label="${e[0][r]}" class="habitat" src="/public/images/habitats/${e[0][r]}.webp"/>`;break;case"color":var i=e[0][r].split(" , ");a.innerHTML=null==i[1]?`<div class="color-square" style="background-color: ${i[0]}"></div>`:`<div class="color-square" style="background-color: ${i[0]}"></div><div class="color-square" style="background-color: ${i[1]}"></div>`;break;case"type":var l=e[0][r].split(" , ");a.innerHTML=null==l[1]?`<img alt="" aria-label="${l[0]}" class="types" src="/public/images/types/${l[0]}.webp"/>`:`<img alt="" aria-label="${l[0]}" class="types" src="/public/images/types/${l[0]}.webp"/><img alt="" aria-label="${l[1]}" class="types" src="/public/images/types/${l[1]}.webp"/>`;break;default:a.innerHTML=`<p class="answers-text">${e[0][r]}</p>`}t.appendChild(a)}s.insertAdjacentElement("afterbegin",t),this.rendered[this.rendered.length]=e}renderState(){this.refreshState();for(var e=this.guesses.length-1;e>=0;e--)this.renderGuess(this.guesses[e])}renderStateDiff(){this.refreshState();for(var e=this.guesses,s=0;s<this.rendered.length;s++){var t=e.findIndex(e=>e[0].name==this.rendered[s][0].name);t>=0&&e.splice(t,1)}for(var s=e.length-1;s>=0;s--)this.renderGuess(e[s])}}