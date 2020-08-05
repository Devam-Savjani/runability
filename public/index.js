(function () {
  /**
   * Obtains parameters from the hash of the URL
   * @return Object
   */
  function getHashParams() {
    var hashParams = {};
    var e,
      r = /([^&;=]+)=?([^&;]*)/g,
      q = window.location.hash.substring(1);
    while ((e = r.exec(q))) {
      hashParams[e[1]] = decodeURIComponent(e[2]);
    }
    return hashParams;
  }

  var params = getHashParams();
  var access_token = params.access_token,
    refresh_token = params.refresh_token,
    error = params.error;

  if (error) {
    alert("There was an error during the authentication");
  } else {
    if (access_token) {
      $("#login").hide();
      $("#loggedin").show();
      $.ajax({
        url: "https://api.spotify.com/v1/me/playlists?limit=20",
        headers: {
          Authorization: "Bearer " + access_token,
        },
        success: function (response) {
          console.log(response);
          response.items.forEach((playlist) => {
            setTimeout(() => {
              const arrAvg = (arr) =>
                arr.reduce((a, b) => a + b, 0) / arr.length;
              let bpms = [],
                ids = [];
              getSongsIDs(
                ids,
                playlist.tracks.total,
                `https://api.spotify.com/v1/playlists/${playlist.id}`,
                access_token
              );
              while (bpms.length < ids.length) {
                $.ajax({
                  url: `https://api.spotify.com/v1/audio-features?ids=${ids.slice(
                    bpms.length,
                    bpms.length + 50
                  )}`,
                  headers: {
                    Authorization: "Bearer " + access_token,
                  },
                  async: false,
                  success: function (response) {
                    response.audio_features.forEach((features) => {
                      try {
                        bpms.push(features.tempo);
                      } catch {}
                    });
                  },
                });
              }

              let a = arrAvg(bpms);
              a = a.toFixed(2);
              bpms = [];
              let b = parseFloat(a) * 1.4 * 0.000621371 * 60;
              b = b.toFixed(2);
              try {
                $("table").append(
                  `<tr class="animate bounceInDown">
                      <td><img width=120 src=${playlist.images[2].url}></td>
                      <td>${playlist.name}</td>
                      <td>${
                        playlist.description
                          ? playlist.description
                          : "No description"
                      }</td>
                      <td>${a}</td>
                      <td>${b}</td>
                   </tr>`
                );
                $("select").append(
                  `<option value="${playlist.id}" name="${playlist.name}">${playlist.name}</option>`
                );
              } catch (error) {
                $("table").append(
                  `<tr class="animate bounceInDown">
                    <td><img width=120 src=${playlist.images[0].url}></td>
                    <td>${playlist.name}</td>
                    <td>${
                      playlist.description
                        ? playlist.description
                        : "No description"
                    }</td>
                    <td>${a}</td>
                    <td>${b}</td>
                   </tr>`
                );
                $("select").append(
                  `<option value="${playlist.id}" name="${playlist.name}">${playlist.name}</option>`
                );
              }
              $("table").css("max-width", "100%");
            }, 0);
          });
        },
      });
    } else {
      // render initial screen
      $("#login").show();
      $("#loggedin").hide();
    }
  }

  document.getElementById("obtain-new-token").addEventListener(
    "click",
    function () {
      $.ajax({
        url: "/refresh_token",
        data: {
          refresh_token: refresh_token,
        },
      }).done(function (data) {
        access_token = data.access_token;
      });
    },
    false
  );

  document
    .getElementById("create-playlist")
    .addEventListener("click", function () {
      var input = parseFloat(
        document.getElementsByName("speed-input")[0].value
      );
      var targetBPMUp = input / (1.4 * 0.000621371 * 60) + 5;
      var targetBPMLo = input / (1.4 * 0.000621371 * 60) - 5;

      var element = document.getElementById("source");
      var playlistSourceID = element.options[element.selectedIndex].value;
      var playlistName = element.options[element.selectedIndex].text;

      if (Number.isNaN(input)) {
        alert("Enter a valid speed");
      } else {
        var user_id;

        // Gets the user_id
        $.ajax({
          url: `https://api.spotify.com/v1/me`,
          headers: {
            Authorization: "Bearer " + access_token,
          },
          success: function (response) {
            user_id = response.id;
          },
        });

        var playlistTotal;
        let ids = [],
          newIds = [];

        // Go through source playlist adds the song ids with a particular
        if (playlistSourceID == "Liked songs") {
          //From Liked songs
          $.ajax({
            url: `https://api.spotify.com/v1/me/tracks`,
            headers: {
              Authorization: "Bearer " + access_token,
            },
            success: function (response) {
              playlistTotal = response.total;
            },
          });

          setTimeout(function () {
            getSongsIDs(
              ids,
              playlistTotal,
              `https://api.spotify.com/v1/me`,
              access_token
            );
            getFilteredIDs(
              playlistTotal,
              ids,
              access_token,
              newIds,
              targetBPMLo,
              targetBPMUp
            );
            createPlaylist(user_id, input, newIds, access_token, playlistName);
            alert("Playlist created!!");
          }, 1000);
        } else {
          //Find the requested playlist length
          $.ajax({
            url: `https://api.spotify.com/v1/playlists/${playlistSourceID}/tracks`,
            headers: {
              Authorization: "Bearer " + access_token,
            },
            success: function (response) {
              playlistTotal = response.total;
            },
          });

          setTimeout(function () {
            getSongsIDs(
              ids,
              playlistTotal,
              `https://api.spotify.com/v1/playlists/${playlistSourceID}`,
              access_token
            );
            getFilteredIDs(
              playlistTotal,
              ids,
              access_token,
              newIds,
              targetBPMLo,
              targetBPMUp
            );
            createPlaylist(user_id, input, newIds, access_token, playlistName);
            alert("Playlist created!!");
          }, 1000);
        }
      }
    });
})();

function isNumber(evt) {
  evt = evt ? evt : window.event;
  var charCode = evt.which ? evt.which : evt.keyCode;
  if ((charCode >= 48 && charCode <= 57) || charCode == 46) {
    return true;
  }
  return false;
}

async function createPlaylist(
  user_id,
  input,
  songIDs,
  access_token,
  playlistName
) {
  var newPlaylistURL = "";
  var myData =
    '{"name":' + `"My ${input}mph run from ${playlistName}", "public":false}`;

  $.ajax({
    type: "POST",
    url: `https://api.spotify.com/v1/users/${user_id}/playlists`,
    headers: {
      Authorization: "Bearer " + access_token,
    },
    contentType: "application/json",
    data: myData,
    success: function (response) {
      newPlaylistURL = response.href;
      var offset = 0;
      var numOfLoops = Math.floor(songIDs.length / 100) + 1;
      var i;
      if (songIDs.length > 0) {
        for (i = 0; i < numOfLoops; i++) {
          $.ajax({
            type: "POST",
            url: `${newPlaylistURL}/tracks?uris=${songIDs.slice(
              offset,
              offset + 100
            )}`,
            headers: {
              Authorization: "Bearer " + access_token,
            },
            contentType: "application/json",
            success: function (response) {},
          });
        }
      }
    },
  });
}

async function getSongsIDs(ids, playlistTotal, url, access_token) {
  while (ids.length < playlistTotal) {
    $.ajax({
      url: `${url}/tracks?offset=${ids.length}`,
      headers: {
        Authorization: "Bearer " + access_token,
      },
      async: false,
      success: function (response) {
        response.items.forEach((item) => {
          try {
            ids.push(item.track.id);
          } catch {}
        });
      },
    });
  }
}

async function getFilteredIDs(
  playlistTotal,
  ids,
  access_token,
  newIds,
  targetBPMLo,
  targetBPMUp
) {
  var currIndex = 0;

  // Gets ids of songs filtered
  while (currIndex < playlistTotal) {
    $.ajax({
      url: `https://api.spotify.com/v1/audio-features?ids=${ids.slice(
        currIndex,
        currIndex + 50
      )}`,
      headers: {
        Authorization: "Bearer " + access_token,
      },
      async: false,
      success: function (response) {
        response.audio_features.forEach((response) => {
          try {
            if (response.tempo > targetBPMLo && response.tempo < targetBPMUp) {
              newIds.push(`spotify%3Atrack%3A${response.id}`);
            }
          } catch {}
        });
      },
    });
    currIndex += 50;
  }
}
