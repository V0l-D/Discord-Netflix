/* global document, location, netflix */

let {
    data
} = require("jquery")

module.exports = function() {
    let [type, id] = location.pathname.split('/').slice(1, 3)
    let avatar = ''
    let userName

    if (netflix) {
        let {
            userGuid,
            name
        } = netflix.reactContext.models.userInfo.data
        avatar = netflix.falcorCache.profiles[userGuid].summary.value.avatarName.split('R|').pop().split('|')[0] 
        userName = name
    }

    if (document.location.pathname.includes("/browse")) {
        return {
            name: 'Browsing',
            episode: 'In the Catalogs',
            avatar,
            userName
        }
    }

    if (document.location.pathname.includes("/title")) {
        let jawBone = document.querySelector('.jawBone .title')
        let episode = jawBone.querySelector('.logo') ?
            jawBone.querySelector('.logo').getAttribute('alt') :
            jawBone.querySelector('.text').innerHTML

        return {
            name: 'Checking a title:',
            episode,
            avatar,
            userName
        }
    }

    //Fixed PIP Credits to kuzudoli: https://github.com/kuzudoli/Miniflix-edge-extension
    (function(){
        console.log("PIP Hooked!")
        //Creates button parent element
        const btnParent = document.createElement("div");
        //Styling button
        btnParent.style.position = "relative";
        btnParent.style.zIndex = "1";
        btnParent.style.textAlign = "center";
        btnParent.style.opacity = "0";
        btnParent.addEventListener("mouseover", () => {
            btnParent.style.opacity = "1";
            setTimeout(() => {
                btnParent.style.opacity = "0";
            },2000);
        });
    
        //Button element
        btnParent.innerHTML =
        `
            <button id='pipBtn' 
                style='width:30px;
                        background-color:rgba(0, 0, 0, 0);
                        margin-top:15px;     
            '><svg width="25" height="25" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="Hawkins-Icon Hawkins-Icon-Standard"><path fill-rule="evenodd" clip-rule="evenodd" d="m19.55311,11.22226l-8.86379,0l0,6.42295l8.82237,0l0,-6.42295l0.04142,0zm4.39048,8.5907l0,-15.01365c0,-1.16416 -0.99407,-2.1276 -2.19524,-2.1276l-19.88141,0c-1.20117,0 -2.19524,0.9233 -2.19524,2.1276l0,15.01365c0,1.16416 0.99407,2.1276 2.19524,2.1276l19.88141,0c1.20117,0 2.19524,-0.96344 2.19524,-2.1276zm-2.19524,0l-19.88141,0l0,-15.01365l19.88141,0l0,15.01365z" fill="currentColor"></path></svg>
            </button>
        `
        //Waits loading video element
        const observer = new MutationObserver((mutations, obs) => {
            const targetNode = document.querySelector('body');
            
            //Parses url and gets id
            const url = window.location.href.toString().split('/');
            if(url[4]){//Video Id
                const filmId = url[4].split('?')[0];
                const videoNode = document.getElementById(filmId);
    
                if (videoNode) {
                    targetNode.prepend(btnParent);//Adds PIP button
                    obs.disconnect();
                    return;
                }
            }        
        });
        
        //Which changes must listen in elements
        observer.observe(document, {
            childList: true,
            subtree: true
        });
    
        //Waits loading PIP button
        const observer2 = new MutationObserver((mutations, obs) => {
            const pipBtn = document.getElementById('pipBtn');
    
            //Parses url and gets id
            const url = window.location.href.toString().split('/');
            if(url[4]){//Video Id
                const filmId = url[4].split('?')[0];
                if (pipBtn) {
                    const videoNode = document.getElementById(filmId);
                    const video = videoNode.firstElementChild;
                    //console.log(video);
                    pipBtn.style.border = "none";
                    if("pictureInPictureEnabled" in document){//If PIP mode enabled adds event listener for disabling
                        pipBtn.addEventListener("click",() => {
                            if(document.pictureInPictureElement){
                                document.exitPictureInPicture().catch(err=>{
                                    console.log(err);
                                });
                                return;
                            }
                            video.requestPictureInPicture().catch(err=>{
                                console.log(err);
                            })
                        })
                    }
                    obs.disconnect();
                    return;
                }
            }
            
        });
    
        //Which changes must listen in elements
        observer2.observe(document, {
            childList: true,
            subtree: true
        });
    
    })();

    //New fix | Discord UI update
    if (document.location.pathname.includes("/watch")) {
        try {

            let name = document.querySelector('.ellipsize-text')
                //Let's get the video ID for the button
            let id = document.querySelector('[data-videoid]').dataset.videoid
            let {
                duration,
                currentTime,
                paused
            } = document.querySelector(".VideoContainer video") ?? document.querySelector(".watch-video--player-view video");
            let title = (document.querySelector("[data-uia$='video-title'] span:nth-child(3)") ?? " ").textContent
            let episode = (document.querySelector("[data-uia$='video-title'] span") ?? " ").textContent
            let interactive = false
            // TODO: Better interactive video check. Severe problems are caused in the solutions currently found
            name = (document.querySelector("[data-uia$='video-title']")).firstChild.textContent
            return {
                duration,
                currentTime,
                paused,
                title,
                episode,
                userName,
                avatar,
                interactive,
                name,
                button: [{
                    label: "Watch",
                    url: "https://netflix.com/watch/" + id
                }]
            } //duration, currentTime, paused}]}
        } catch (error) {
            //Ignore error due new Netflix UI
        }
    }
}
