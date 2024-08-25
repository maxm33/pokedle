import{initializeApp as t}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";import{getAuth as e,GoogleAuthProvider as n,onAuthStateChanged as i,signInWithPopup as a,signOut as o}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";import{pokemons as r}from"./pokemon.js";import{AppState as s}from"./appState.js";Notification.requestPermission(t=>{"granted"!=t?console.log("Notifications: no permission"):console.log("Notifications: enabled")});let loginButton=document.getElementById("login-button"),profileButton=document.getElementById("profile-button"),pokedexButton=document.getElementById("pokedex-button"),rankingButton=document.getElementById("ranking-button"),guessButton=document.getElementById("guess-button"),prevtitle=document.getElementById("prev-title"),timer=document.getElementById("timer"),subtitle=document.getElementById("subtitle"),containertitles=document.getElementById("titles-container"),containerbar=document.getElementById("textbar-container"),containerstate=document.getElementById("state-container"),input=document.getElementById("textbar"),textbar=document.getElementById("autocomplete"),appState=new s,provider=new n,config=await axios.get("/env/fb"),auth=e(t(config.data));null==appState.getID()&&await axios.get("/user/id").then(t=>{appState.setID(t.data)});let userID=appState.getID();axios.get("/classic/state").then(t=>{manageGameState(t.data[0],t.data[1],t.data[2])}),autocomplete(input,r);let unsubscribe=i(auth,t=>{t?(loginButton.value="Logout",fadeIn(profileButton,"1s"),fadeIn(pokedexButton,"1s")):(loginButton.value="Login ",fadeOut(profileButton,"1.5s"),fadeOut(pokedexButton,"1.5s")),axios.get("/user/"+(t?auth.currentUser.uid:userID)+"/canPlay").then(t=>{var e=`<p>I'm thinking of a <span style="color:#8cff66">Pok\xe9mon</span>, can you guess it?</p>`,n="<p>Don't move! Next will be legen... Wait for it...</p>";t.data?(subtitle.innerHTML!=e&&(triggerElementAnimation(subtitle,"fadeIn"),subtitle.innerHTML=e),"none"==containerbar.style.display&&(triggerElementAnimation(containerbar,"fadeIn"),containerbar.style.display="block"),"none"==containerstate.style.display&&(triggerElementAnimation(containerstate,"fadeIn"),containerstate.style.display="block")):(subtitle.innerHTML!=n&&(triggerElementAnimation(subtitle,"fadeIn"),subtitle.innerHTML=n),"block"==containerbar.style.display&&(triggerElementAnimation(containerbar,"fadeOut"),setTimeout(()=>containerbar.style.display="none",1150)),"block"==containerstate.style.display&&(triggerElementAnimation(containerstate,"fadeOut"),setTimeout(()=>containerstate.style.display="none",1150)))})});function manageGameState(t,e,n){null!=n&&(prevtitle.innerHTML='<p>Previous Pok\xe9mon was <span style="color:#ff6666">'+n.name+" #"+n.ID,fadeIn(prevtitle,"1.5s"));var i=appState.getGameID();(null==i||i!=t)&&(appState.setGameID(t),appState.removeState()),appState.notRendered()&&appState.getTries()>0&&fadeIn(containertitles,"1.5s"),appState.renderState(),setInterval(()=>{appState.notRendered()&&appState.getTries()>0&&fadeIn(containertitles,"1.5s"),appState.renderStateDiff()},6e4),setTimeout(()=>{sendNotification("A new Pok\xe9mon is waiting for you!"),appState.removeState(),window.location.reload()},e);var a=Math.floor(e/1e3),o=a%3600,r=Math.floor(a/3600),s=Math.floor(o/60),l=o%60;setInterval(()=>{(!(r<=0)||!(s<=0)||!(l<=0))&&(r>=1&&0==s&&0==l?(r--,s=59,l=59):s>=1&&0==l?(s--,l=59):l--,timer.textContent="A new Pok\xe9mon is spawning in "+(r<10?"0"+r:r)+":"+(s<10?"0"+s:s)+":"+(l<10?"0"+l:l))},1e3)}function fadeIn(t,e){t.style.animation="fadeIn "+e,t.style.visibility="visible"}function fadeOut(t,e){t.style.animation="fadeOut "+e,setTimeout(()=>t.style.visibility="hidden",1150)}function triggerElementAnimation(t,e){for(;t.classList.length>0;)t.classList.remove(t.classList.item(0));t.offsetWidth,t.classList.add(e)}function onVictory(t,e){var n=new Audio("public/audio/victory-sound.mp3");n.volume=.1,n.play(),setTimeout(()=>{var n=document.createElement("DIV");n.setAttribute("id","victory-ad-container"),subtitle.insertAdjacentElement("afterend",n),n.innerHTML=`<div id="victory-text1"><b>GG!</b></div><div id="victory-text2"><b>It was ${e} indeed!</b></div><div><img alt="" style="animation: fadeIn 500ms" src='/public/images/sprites/${e}.webp' width='180px' height='180px'></div><div id="victory-text3"><b>You guessed it in ${t} tries...</b></div><div id="victory-text4"><b>Think you can do better? Let's see!</b></div><a aria-label="Go to Home" href='/'><button id='continue-button'>Continue</button></a>`},1e3)}function sendNotification(t){"Notification"in window&&Notification.requestPermission().then(e=>{"granted"===e&&new Notification("Pok\xe9dle",{body:t,icon:"/public/images/icon-192x192.webp"})})}function autocomplete(t,e){function n(e){for(var n=document.getElementsByClassName("autocomplete-items"),i=0;i<n.length;i++)e!=n[i]&&e!=t&&n[i].parentNode.removeChild(n[i])}t.addEventListener("input",function(){var i=this.value;if(n(),!i)return!1;var a=document.createElement("DIV");a.setAttribute("id",this.id+"-autocomplete-list"),a.setAttribute("class","autocomplete-items"),this.parentNode.appendChild(a);for(var o=0;o<e.length;o++)if(e[o].substr(0,i.length).toUpperCase()==i.toUpperCase()){var r=document.createElement("DIV");r.className="list-options",r.innerHTML=`<img alt="" src='/public/images/sprites/${e[o]}.webp' width='70px' height='70px'><strong style="color: lightgreen;">${e[o].substr(0,i.length)}</strong>${e[o].substr(i.length)}<input type='hidden' value='${e[o]}'>`,r.addEventListener("click",function(){t.value=this.getElementsByTagName("input")[0].value,n()}),a.appendChild(r)}}),document.addEventListener("click",t=>{n(t.target)})}loginButton.addEventListener("click",()=>{unsubscribe(),null==auth.currentUser?a(auth,provider).then(()=>{auth.currentUser.getIdToken().then(t=>{axios.put("/user/"+auth.currentUser.uid,{name:auth.currentUser.displayName,token:t}),window.location.reload()})}):o(auth).then(()=>{window.location.reload()})}),profileButton.addEventListener("click",()=>{window.location.href=`/user/${auth.currentUser.uid}/profile`}),pokedexButton.addEventListener("click",()=>{window.location.href=`/user/${auth.currentUser.uid}/pokedex`}),rankingButton.addEventListener("click",()=>{window.location.href="/classic/ranking"}),guessButton.addEventListener("click",async()=>{var t=input.value;if(input.value="",""==t||!r.includes(t)){triggerElementAnimation(textbar,"shake");return}var e=null;null!=auth.currentUser&&(e=await auth.currentUser.getIdToken()),axios.post("/classic",{token:e,uid:userID,guess:t,tries:appState.getTries()+1}).then(t=>{appState.notRendered()&&fadeIn(containertitles,"1.5s"),appState.add(t.data),t.data[1].hasWon&&(input.disabled=!0,onVictory(appState.getTries(),t.data[0].name),appState.removeState())}).catch(t=>console.error(t))});