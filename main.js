var wsChannelPoints;
var wsChatBot;

var latestRedeem;
var redemptionId;

function getTwitchBroadcasterAccessToken(localStorage) {
  if (localStorage) {
    return window.localStorage.getItem("twitchBroadcasterToken");
  }
  return twitchBroadcasterOAuthToken;
}
function getTwitchBroadcasterRefreshToken(localStorage) {
  if (localStorage) {
    return window.localStorage.getItem("twitchBroadcasterRefreshToken");
  }
  return twitchBroadcasterRefreshToken;
}

function getTwitchBotAccessToken(localStorage) {
  if (localStorage) {
    return window.localStorage.getItem("twitchBotToken");
  }
  return twitchBotOAuthToken;
}
function getTwitchBotRefreshToken(localStorage) {
  if (localStorage) {
    return window.localStorage.getItem("twitchBotRefreshToken");
  }
  return twitchBotRefreshToken;
}

function getSpotifyAccessToken(localStorage) {
  if (localStorage) {
    return window.localStorage.getItem("spotifyToken");
  }
  return spotifyOAuthToken;
}
function getSpotifyRefreshToken() {
  return spotifyRefreshToken;
}

function saveTwitchBroadcasterAccessToken(token) {
  window.localStorage.setItem("twitchBroadcasterToken", token);
}
function saveTwitchBroadcasterRefreshToken(token) {
  window.localStorage.setItem("twitchBroadcasterRefreshToken", token);
}

function saveTwitchBotAccessToken(token) {
  window.localStorage.setItem("twitchBotToken", token);
}
function saveTwitchBotRefreshToken(token) {
  window.localStorage.setItem("twitchBotRefreshToken", token);
}

function saveSpotifyAccessToken(token) {
  window.localStorage.setItem("spotifyToken", token);
}

async function checkTwitchAuth(isBroadcaster) {
  var account = isBroadcaster ? "broadcaster" : "bot";
  var accessToken = isBroadcaster ? getTwitchBroadcasterAccessToken(true) : getTwitchBotAccessToken(true);
  var result = await validateTwitchAuth(accessToken);
  if (!result) {
    console.log("Failed to log in to " + account + " Twitch account with localStorage token.");
    var refreshToken = isBroadcaster ? getTwitchBroadcasterRefreshToken(true) : getTwitchBotRefreshToken(true);
    result = await refreshTwitchToken(refreshToken, isBroadcaster);
    if (!result) {
      console.log("Failed to refresh token to " + account + " Twitch account with localStorage refresh token.");
      var accessToken = isBroadcaster ? getTwitchBroadcasterAccessToken(false) : getTwitchBotAccessToken(false);
      result = await validateTwitchAuth(accessToken);
      if (!result) {
        console.log("Failed to log in with to " + account + " Twitch account tokens.js token.");
        var refreshToken = isBroadcaster ? getTwitchBroadcasterRefreshToken(false) : getTwitchBotRefreshToken(false);
        result = await refreshTwitchToken(refreshToken, isBroadcaster);
      } else {
        if (isBroadcaster) {
          saveTwitchBroadcasterAccessToken(getTwitchBroadcasterAccessToken(false));
          saveTwitchBroadcasterRefreshToken(getTwitchBroadcasterRefreshToken(false));
        } else {
          saveTwitchBotAccessToken(getTwitchBotAccessToken(false));
          saveTwitchBotRefreshToken(getTwitchBotRefreshToken(false));
        }
      }
    }
  }
  if (result) {
    console.log("Succesfully logged in to " + account + " Twitch account.");
  } else {
    console.log("Unable to login to " + account + " Twitch account.");
  }
}

async function validateTwitchAuth(token) {
  var url = "https://id.twitch.tv/oauth2/validate";
  var authToken = "OAuth " + token;
  var succesful = await fetch(url, {
    headers: { Authorization: authToken },
  }).then(async function (response) {
    console.log(await response.json());
    if (response.status === 200) {
      return true;
    }
    return false;
  });
  return succesful;
}

async function refreshTwitchToken(token, isBroadcaster) {
  const requestBody = new URLSearchParams();
  requestBody.append("grant_type", "refresh_token");
  requestBody.append("refresh_token", token);
  requestBody.append("client_id", twitchClientId);
  requestBody.append("client_secret", twitchClientSecret);

  var succesful = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: requestBody,
  }).then(async function (response) {
    var json = await response.json();
    if (response.status === 200) {
      if (isBroadcaster) {
        saveTwitchBroadcasterAccessToken(json["access_token"]);
        saveTwitchBroadcasterRefreshToken(json["refresh_token"]);
      } else {
        saveTwitchBotAccessToken(json["access_token"]);
        saveTwitchBotRefreshToken(json["refresh_token"]);
      }
      console.log("Succesfully refreshed Twitch access token.");
    } else {
      console.log("Unable to refresh Twitch access token.");
    }
    return response.status === 200;
  });
  return succesful;
}

async function checkSpotifyAuth() {
  var result = await validateSpotifyAuth(getSpotifyAccessToken(true));
  if (!result) {
    console.log("Failed to log in to Spotify with localStorage token.");
    result = await refreshSpotifyToken();
    if (!result) {
      console.log("Failed to refresh token to Spotify with localStorage refresh token.");
      result = await validateSpotifyAuth(getSpotifyAccessToken(false));
      if (!result) {
        console.log("Failed to log in to Spotify with tokens.js token.");
        result = await refreshSpotifyToken();
      } else {
        saveSpotifyAccessToken(getSpotifyAccessToken(false));
      }
    }
  }
  if (result) {
    console.log("Succesfully logged in to Spotify.");
  } else {
    console.log("Unable to login to Spotify.");
  }
}

async function validateSpotifyAuth(token) {
  var url = "https://api.spotify.com/v1/me";
  var successful = await fetch(url, {
    headers: { Authorization: "Bearer " + token },
  }).then(function (response) {
    return response.status === 200;
  });
  return successful;
}

async function refreshSpotifyToken() {
  const requestBody = new URLSearchParams();
  requestBody.append("grant_type", "refresh_token");
  requestBody.append("refresh_token", getSpotifyRefreshToken());

  var succesful = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + btoa(spotifyClientId + ":" + spotifyClientSecret),
    },
    body: requestBody,
  }).then(async function (response) {
    var json = await response.json();
    if (response.status === 200) {
      saveSpotifyAccessToken(json["access_token"]);
      console.log("Succesfully refreshed Spotify access token.");
    } else {
      console.log("Unable to refresh Spotify access token.");
    }
    return response.status === 200;
  });
  return succesful;
}

async function parseSongRequest(text) {
  // check if request contains youtube link like youtube.com or youtu.be
  if (text.includes("youtube.com") || text.includes("youtu.be")) {
    await refundChannelPoints();
    return "YouTube links are not supported. Please use Spotify links or search for a song by name.";
  }

  var status = await validateSpotifyAuth(getSpotifyAccessToken(true));
  if (!status) {
    await checkSpotifyAuth();
    var status = await validateSpotifyAuth(getSpotifyAccessToken(true));
    if (!status) {
      await refundChannelPoints();
      return "Unable to connect to Spotify. Channel points have been refunded (or not).";
    }
  }

  let uri = "";

  if (text.includes("open.spotify.com/track/")) {
    uri = text.split("track/")[1];
    uri = uri.split("?")[0];
  } else if (text.includes("spotify:track:")) {
    uri = uri.split(":")[2];
  } else {
    uri = await spotifySearch(text);
  }

  if (uri === "") {
    await refundChannelPoints();
    return 'No songs were found for "' + text + '". Channel points have been refunded.';
  } else {
    return spotifyTrack(uri);
  }
}

async function spotifyTrack(songUri) {
  var url = "https://api.spotify.com/v1/tracks/" + songUri + "?market=FI";
  const data = await fetch(url, {
    headers: { Authorization: "Bearer " + getSpotifyAccessToken(true) },
  }).then(function (response) {
    return response.json();
  });
  console.log(data);
  var deviceId = await getFirstComputerDeviceId();
  if (deviceId === null) {
    await refundChannelPoints();
    return "No computer devices available. Channel points have been refunded.";
  }
  var queueResult = await spotifyAddToQueue("spotify:track:" + songUri, deviceId);
  if (queueResult) {
    var songName = data["name"];
    var artistName = data.artists.map((artist) => artist.name);
    return 'The song "' + songName + '" by "' + artistName.join(", ") + '" was added to the queue.';
  } else {
    await refundChannelPoints();
    return "Spotify returned error. Channel points have been refunded.";
  }
}

async function spotifySearch(searchTerm) {
  searchTerm = encodeURIComponent(searchTerm);
  var url = "https://api.spotify.com/v1/search?q=" + searchTerm + "&type=track&market=FI&limit=1";
  const data = await fetch(url, {
    headers: { Authorization: "Bearer " + getSpotifyAccessToken(true) },
  }).then(function (response) {
    return response.json();
  });
  console.log(data);
  if (data["tracks"]["total"] == 0) {
    return "";
  }
  var uri = data["tracks"]["items"]["0"]["uri"];
  return uri.split(":")[2];
}

async function spotifyAddToQueue(songUri, deviceId = null) {
  var url = "https://api.spotify.com/v1/me/player/queue?uri=" + songUri;
  if (deviceId !== null) {
    url += "&device_id=" + deviceId;
  }
  var result = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + getSpotifyAccessToken(true) },
  }).then(function (response) {
    return response.status === 200;
  });
  return result;
}

async function getFirstComputerDeviceId() {
  var url = "https://api.spotify.com/v1/me/player/devices";
  const data = await fetch(url, {
    headers: { Authorization: "Bearer " + getSpotifyAccessToken(true) },
  }).then(function (response) {
    return response.json();
  });
  console.log(data);

  for (var i = 0; i < data.devices.length; i++) {
    if (data.devices[i].type === "Computer") {
      return data.devices[i].id;
    }
  }

  return null;
}

async function refundChannelPoints() {
  var url =
    "https://api.twitch.tv/helix/channel_points/custom_rewards/redemptions?id=" +
    latestRedeem +
    "&broadcaster_id=" +
    twitchBroadcasterId +
    "&reward_id=" +
    redemptionId;
  const data = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer " + getTwitchBroadcasterAccessToken(true),
      "Content-Type": "application/json",
      "client-id": twitchClientId,
    },
    body: '{"status":"CANCELED"}',
  }).then(function (response) {
    return response;
  });
  console.log(data);
  return data;
}

function connectChatBot() {
  var reconnectInterval = 1000 * 3;

  wsChatBot = new WebSocket("ws://irc-ws.chat.twitch.tv:80");

  wsChatBot.onopen = function (event) {
    console.log(event);
    console.log("wsChatBot Socket Opened");
    wsChatBot.send("CAP REQ : twitch.tv/tags twitch.tv/commands");
    wsChatBot.send("PASS oauth:" + getTwitchBotAccessToken(true));
    wsChatBot.send("NICK " + twitchBotName);
    wsChatBot.send("JOIN #vaarattu");
  };

  wsChatBot.onmessage = async function (event) {
    message = event.data;
    // TODO JOS EPÄONNISTUU KOITA REFRESH TOKEN
    console.log(event);
    console.log(message);
    if (message.includes("custom-reward-id")) {
      console.log("wsChatBot.onmessage: " + message);
      var split = message.split(";");
      latestMsgIndex = split.findIndex((item) => item.startsWith("id="));
      latestMsg = split[latestMsgIndex].split("=")[1];
      customRewardIdIndex = split.findIndex((item) => item.startsWith("custom-reward-id="));
      redeemId = split[customRewardIdIndex].split("=")[1];
      if (redeemId === twitchChannelRedeemId) {
        chatMessageTextIndex = split.findIndex((item) => item.includes("PRIVMSG"));
        chatMessageTextSplit = split[chatMessageTextIndex].split(":");
        chatMessageText = chatMessageTextSplit[chatMessageTextSplit.length - 1];
        var response = await parseSongRequest(chatMessageText);
        wsChatBot.send("@reply-parent-msg-id=" + latestMsg + " PRIVMSG #vaarattu :" + response);
      }
    }
  };

  wsChatBot.onclose = async function () {
    await checkTwitchAuth(false);
    console.log("wsChatBot Socket Closed");
    setTimeout(connectChatBot, reconnectInterval);
  };
}

function sleepTime(timeS) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, timeS);
  });
}

function nonce(length) {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function heartbeat(ws) {
  message = {
    type: "PING",
  };
  ws.send(JSON.stringify(message));
}

function listen(ws, topic) {
  message = {
    type: "LISTEN",
    nonce: nonce(15),
    data: {
      topics: [topic],
      auth_token: getTwitchBroadcasterAccessToken(true),
    },
  };
  ws.send(JSON.stringify(message));
}

async function connectChannelPoints() {
  var heartbeatInterval = 1000 * 60;
  var reconnectInterval = 1000 * 3;
  var heartbeatHandle;

  wsChannelPoints = new WebSocket("wss://pubsub-edge.twitch.tv");

  wsChannelPoints.onopen = function (event) {
    console.log(event);
    console.log("wsChannelPoints Socket Opened");
    heartbeat(wsChannelPoints);
    heartbeatHandle = setInterval(heartbeat(wsChannelPoints), heartbeatInterval);
    console.log("Listening on channel id: " + twitchBroadcasterId);
    listen(wsChannelPoints, "channel-points-channel-v1." + twitchBroadcasterId);
  };

  wsChannelPoints.onmessage = async function (event) {
    message = JSON.parse(event.data);
    console.log("wsChannelPoints.onmessage: " + message["type"]);
    console.log(message);

    if (message.type == "RECONNECT") {
      console.log("Reconnecting...");
      setTimeout(connect, reconnectInterval);
    }
    if (message["type"] == "MESSAGE") {
      var messageData = JSON.parse(message["data"]["message"]);
      console.log(messageData);
      var rewardId = messageData["data"]["redemption"]["reward"]["id"];
      if (rewardId == twitchChannelRedeemId) {
        redemptionId = messageData["data"]["redemption"]["reward"]["id"];
        latestRedeem = messageData["data"]["redemption"]["id"];
        twitchName = messageData["data"]["redemption"]["user"]["display_name"];
        rewardInput = messageData["data"]["redemption"]["user_input"];
        //var response = await parseSongRequest(rewardInput);
        //wsChatBot.send("@reply-parent-msg-id=" + latestMsg + " PRIVMSG #vaarattu :" + response);
      }
    }
  };

  wsChannelPoints.onclose = async function () {
    await checkTwitchAuth(true);
    console.log("wsChannelPoints Socket Closed");
    clearInterval(heartbeatHandle);
    setTimeout(connectChannelPoints, reconnectInterval);
  };
}

async function start() {
  await checkTwitchAuth(true);
  await checkTwitchAuth(false);
  await checkSpotifyAuth();
  connectChannelPoints();
  connectChatBot();
}

start();
