/* global document, location, netflix */

let { data } = require("jquery")

module.exports = function () {
    let [type, id] = location.pathname.split('/').slice(1, 3)
    let avatar = ''
    let userName

    if (netflix) {
        let { userGuid, name } = netflix.reactContext.models.userInfo.data
        avatar = netflix.falcorCache.profiles[userGuid].summary.value.avatarName.split('R|').pop().split('|')[0]//Okay wtf this works lol
        userName = name
    }

    if (document.location.pathname.includes("/browse")) {
        return {
            name   : 'Browsing',
            episode: 'In the Catalogs',
            avatar,
            userName
        }
    }

    if (document.location.pathname.includes("/title")) {
        let jawBone = document.querySelector('.jawBone .title')
        let episode = jawBone.querySelector('.logo')
            ? jawBone.querySelector('.logo').getAttribute('alt')
            : jawBone.querySelector('.text').innerHTML

        return {
            name: 'Checking a title:',
            episode,
            avatar,
            userName
        }
    }


    //New fix | Discord UI update
    if (document.location.pathname.includes("/watch")) {
        try{

        let name = document.querySelector('.ellipsize-text')
        //Let's get the video ID for the button
        let id = document.querySelector('[data-videoid]').dataset.videoid
        let { duration, currentTime, paused } = document.querySelector(".VideoContainer video")
      ?? document.querySelector(".watch-video--player-view video");
        let title = (document.querySelector("[data-uia$='video-title'] span:nth-child(3)")
        ?? " ").textContent
        let episode = (document.querySelector("[data-uia$='video-title'] span")
        ?? " ").textContent
        let interactive = false
        // TODO: Better interactive video check. Severe problems are caused in the solutions currently found
        name = (document.querySelector("[data-uia$='video-title']")).firstChild.textContent
        return {duration, currentTime, paused, title, episode, userName, avatar, interactive, name, button: [{ label: "Watch", url: "https://netflix.com/watch/" + id}] }//duration, currentTime, paused}]}
    }
    catch(error){
        //Ignore error due new Netflix UI
    }
    }
    }
