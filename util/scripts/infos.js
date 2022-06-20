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

    if (document.location.pathname.includes("/watch")) {
        //run pip file here
        /*
                    let $togglePipBtn
            const ICON_SVG =
            '<svg id="pip" width="24" height="24" viewBox="0 0 24 24" class="Hawkins-Icon Hawkins-Icon-Standard" xmlns="http://www.w3.org/2000/svg" data-uia="control-pip-enter">' +
              '<g>' +
                '<path fill-rule="evernodd" clip-rule="evernodd" fill="currentColor" d="m19.55311,11.22226l-8.86379,0l0,6.42295l8.82237,0l0,-6.42295l0.04142,0zm4.39048,8.5907l0,-15.01365c0,-1.16416 -0.99407,-2.1276 -2.19524,-2.1276l-19.88141,0c-1.20117,0 -2.19524,0.9233 -2.19524,2.1276l0,15.01365c0,1.16416 0.99407,2.1276 2.19524,2.1276l19.88141,0c1.20117,0 2.19524,-0.96344 2.19524,-2.1276zm-2.19524,0l-19.88141,0l0,-15.01365l19.88141,0l0,15.01365z"/>' +
              '</g>' +
            '</svg>'
            
            const DEBUG = false
            
            function logDebug (msg) {
              if (!DEBUG) { return }
              console.log(`${msg}`)
            }
            
            function tryAddPipToggleButton () {
              const video = ('video')
              const playerControlRow = ('div[data-uia="controls-standard"]')
              togglePipBtn = ('button[data-uia="control-pip-enter"]')
              if (playerControlRow.length && video.length && !togglePipBtn.length) {
                const fullscreenBtn = ('button[data-uia="control-fullscreen-enter"]')
                const btnContainter = fullscreenBtn.parent().parent()
            
                // Clone fullcreen toggle and re-append as PiP toggle
                const fullscreenToggleClone = fullscreenBtn.parent().clone()
                const separatorClone = fullscreenBtn.parent().prev('div').clone()
            
                // Override existing attributes
                fullscreenToggleClone.find('button').attr('data-uia', 'control-pip-enter')
                fullscreenToggleClone.find('button').attr('aria-label', 'Picture in picture')
                fullscreenToggleClone.find('svg').replaceWith(ICON_SVG)
                ('svg[pip]').each(function () {
                  this.width = this.parentNode.width
                  this.height = this.parentNode.height
                })
            
                // Re-assign
                const pipToggle = fullscreenToggleClone
            
                // Append to the video controls
                separatorClone.appendTo(btnContainter)
                pipToggle.appendTo(btnContainter)
                logDebug('Netflix PiP appended to controls')
            
                pipToggle.mouseover(async function (event) {
                  pipToggle.addClass('active')
                  pipToggle.attr('style', 'transform: scale(1.2);')
                })
            
                pipToggle.mouseleave(async function (event) {
                  pipToggle.removeClass('active')
                  pipToggle.removeAttr('style')
                })
            
            pipToggle.click(async function (event) {
                  pipToggle.disabled = true // disable toggle button while the event occurs
                  try {
                    // If there is no element in Picture-in-Picture yet, request for it
                    if (video !== document.pictureInPictureElement) {
                      await video[0].requestPictureInPicture()
                    } else {
                      // If Picture-in-Picture already exists, exit the mode
                      await document.exitPictureInPicture()
                    }
                  } catch (error) {
                    logDebug(`Error! ${error}`)
                  } finally {
                    pipToggle.disabled = false // enable toggle button after the event
                  }
                })
            
                video.bind('enterpictureinpicture', function (event) {
                  logDebug('Netflix watch entered PiP')
                })
            
                video.bind('leavepictureinpicture', function (event) {
                  logDebug('Netflix watch left PiP')
                  pipToggle.disabled = false
                })
              }
            }

                setInterval(function () {
                  logDebug('Check for video control row in DOM and add PiP toggle')
                  tryAddPipToggleButton()
                }, 10) // every 10ms*/
        }


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