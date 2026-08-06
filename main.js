var wsChannelPoints;
var wsChatBot;

var latestRedeem;
var redemptionId;
var pendingSongChoices = new Map();
var recentRedemptions = [];
var skipVoteState = null;

var SPOTIFY_SEARCH_RESULT_LIMIT = 5;
var SPOTIFY_CHOICE_RESULT_LIMIT = 3;
var SPOTIFY_CONFIDENCE_THRESHOLD = 0.74;
var SPOTIFY_CLEAR_WIN_MARGIN = 0.08;
var SONG_CHOICE_TIMEOUT_MS = 1000 * 45;
var REQUIRED_SKIP_VOTES = 5;
var SKIP_TIMEOUT_MS = 1000 * 30;
var REDEMPTION_MATCH_TIMEOUT_MS = 1000 * 3;
var REDEMPTION_MATCH_INTERVAL_MS = 100;

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

function getChatChannel() {
  return "#" + twitchBroadcasterName.toLowerCase();
}

function twitchSafeText(text) {
  return String(text).replace(/[\r\n]+/g, " ").trim();
}

function shortenText(text, maxLength) {
  text = twitchSafeText(text);
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3).trim() + "...";
}

function sendChatMessage(text, replyParentMsgId = null) {
  if (!wsChatBot || wsChatBot.readyState !== WebSocket.OPEN) {
    console.log("Unable to send chat message because chat socket is not open.");
    return;
  }
  var replyPrefix = replyParentMsgId ? "@reply-parent-msg-id=" + replyParentMsgId + " " : "";
  wsChatBot.send(replyPrefix + "PRIVMSG " + getChatChannel() + " :" + shortenText(text, 450));
}

function unescapeTwitchTagValue(value) {
  return value.replace(/\\s/g, " ").replace(/\\:/g, ";").replace(/\\r/g, "\r").replace(/\\n/g, "\n").replace(/\\\\/g, "\\");
}

function parseTwitchPrivmsg(rawMessage) {
  if (!rawMessage.includes(" PRIVMSG ")) {
    return null;
  }

  var tags = {};
  var messageStartIndex = 0;
  if (rawMessage.startsWith("@")) {
    var tagEndIndex = rawMessage.indexOf(" ");
    var tagText = rawMessage.substring(1, tagEndIndex);
    var tagParts = tagText.split(";");
    for (var i = 0; i < tagParts.length; i++) {
      var tagSplit = tagParts[i].split("=");
      tags[tagSplit[0]] = unescapeTwitchTagValue(tagSplit.slice(1).join("="));
    }
    messageStartIndex = tagEndIndex + 1;
  }

  var login = "";
  if (rawMessage.charAt(messageStartIndex) === ":") {
    var prefixEndIndex = rawMessage.indexOf(" ", messageStartIndex);
    var prefix = rawMessage.substring(messageStartIndex + 1, prefixEndIndex);
    login = prefix.split("!")[0];
  }

  var textStartIndex = rawMessage.indexOf(" :", rawMessage.indexOf(" PRIVMSG "));
  var text = textStartIndex === -1 ? "" : rawMessage.substring(textStartIndex + 2);

  return {
    raw: rawMessage,
    tags: tags,
    messageId: tags["id"] || "",
    customRewardId: tags["custom-reward-id"] || "",
    userId: tags["user-id"] || "",
    displayName: tags["display-name"] || login,
    login: login,
    text: text,
  };
}

function getUserKey(chatMessage) {
  if (chatMessage.userId) {
    return chatMessage.userId;
  }
  if (chatMessage.login) {
    return chatMessage.login.toLowerCase();
  }
  return chatMessage.displayName.toLowerCase();
}

function isReplyToBot(chatMessage) {
  var parentUserId = chatMessage.tags["reply-parent-user-id"] || "";
  var parentDisplayName = chatMessage.tags["reply-parent-display-name"] || "";
  return parentUserId === twitchBotId || parentDisplayName.toLowerCase() === twitchBotName.toLowerCase();
}

async function ensureSpotifyAuth() {
  var status = await validateSpotifyAuth(getSpotifyAccessToken(true));
  if (!status) {
    await checkSpotifyAuth();
    status = await validateSpotifyAuth(getSpotifyAccessToken(true));
  }
  return status;
}

function refundStatusText(refunded) {
  if (refunded) {
    return "Channel points have been refunded.";
  }
  return "I could not refund channel points automatically.";
}

async function parseSongRequest(text, requestContext) {
  // check if request contains youtube link like youtube.com or youtu.be
  if (text.includes("youtube.com") || text.includes("youtu.be")) {
    var refundedYoutube = await refundChannelPoints(requestContext);
    return "YouTube links are not supported. Please use Spotify links or search for a song by name. " + refundStatusText(refundedYoutube);
  }

  var status = await ensureSpotifyAuth();
  if (!status) {
    var refundedAuth = await refundChannelPoints(requestContext);
    return "Unable to connect to Spotify. " + refundStatusText(refundedAuth);
  }

  let uri = "";

  if (text.includes("open.spotify.com/track/")) {
    uri = text.split("track/")[1];
    uri = uri.split("?")[0];
  } else if (text.includes("spotify:track:")) {
    uri = text.split("spotify:track:")[1].split(" ")[0];
  } else {
    var searchResult = await spotifySearch(text);
    if (searchResult.uri !== "") {
      uri = searchResult.uri;
    } else if (searchResult.choices.length > 0) {
      await createPendingSongChoice(requestContext, searchResult.choices);
      return formatSongChoiceMessage(searchResult.choices);
    }
  }

  if (uri === "") {
    var refundedSearch = await refundChannelPoints(requestContext);
    return 'No songs were found for "' + text + '". ' + refundStatusText(refundedSearch);
  } else {
    return spotifyTrack(uri, requestContext);
  }
}

async function spotifyTrack(songUri, requestContext) {
  var url = "https://api.spotify.com/v1/tracks/" + songUri + "?market=FI";
  const data = await fetch(url, {
    headers: { Authorization: "Bearer " + getSpotifyAccessToken(true) },
  }).then(function (response) {
    return response.json();
  });
  console.log(data);
  var deviceId = await getFirstComputerDeviceId();
  if (deviceId === null) {
    var refundedDevice = await refundChannelPoints(requestContext);
    return "No computer devices available. " + refundStatusText(refundedDevice);
  }
  var queueResult = await spotifyAddToQueue("spotify:track:" + songUri, deviceId);
  if (queueResult) {
    var songName = data["name"];
    var artistName = data.artists.map((artist) => artist.name);
    return 'The song "' + songName + '" by "' + artistName.join(", ") + '" was added to the queue.';
  } else {
    var refundedQueue = await refundChannelPoints(requestContext);
    return "Spotify returned error. " + refundStatusText(refundedQueue);
  }
}

async function spotifySearch(searchTerm) {
  var url = "https://api.spotify.com/v1/search?q=" + encodeURIComponent(searchTerm) + "&type=track&market=FI&limit=" + SPOTIFY_SEARCH_RESULT_LIMIT;
  const data = await fetch(url, {
    headers: { Authorization: "Bearer " + getSpotifyAccessToken(true) },
  }).then(function (response) {
    return response.json();
  });
  console.log(data);
  if (data["tracks"]["total"] == 0) {
    return { uri: "", choices: [] };
  }

  var candidates = data["tracks"]["items"].map(function (track, index) {
    return {
      id: track.id || track.uri.split(":")[2],
      name: track.name,
      artists: track.artists.map((artist) => artist.name),
      score: calculateSpotifyMatchScore(searchTerm, track, index),
    };
  });
  candidates.sort(function (a, b) {
    return b.score - a.score;
  });

  var best = candidates[0];
  var secondScore = candidates.length > 1 ? candidates[1].score : 0;
  var isConfident = best.score >= SPOTIFY_CONFIDENCE_THRESHOLD && best.score - secondScore >= SPOTIFY_CLEAR_WIN_MARGIN;
  if (best.score >= 0.9) {
    isConfident = true;
  }

  if (isConfident) {
    return { uri: best.id, choices: [] };
  }

  return { uri: "", choices: candidates.slice(0, SPOTIFY_CHOICE_RESULT_LIMIT) };
}

function normalizeSearchText(text) {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getTokens(text) {
  var normalized = normalizeSearchText(text);
  if (normalized === "") {
    return [];
  }
  return normalized.split(/\s+/);
}

function tokenOverlapScore(queryText, candidateText) {
  var queryTokens = getTokens(queryText);
  var candidateTokens = getTokens(candidateText);
  if (queryTokens.length === 0 || candidateTokens.length === 0) {
    return 0;
  }
  var candidateTokenSet = new Set(candidateTokens);
  var matches = 0;
  for (var i = 0; i < queryTokens.length; i++) {
    if (candidateTokenSet.has(queryTokens[i])) {
      matches++;
    }
  }
  return matches / queryTokens.length;
}

function levenshteinDistance(a, b) {
  if (a.length === 0) {
    return b.length;
  }
  if (b.length === 0) {
    return a.length;
  }

  var previousRow = [];
  for (var i = 0; i <= b.length; i++) {
    previousRow[i] = i;
  }

  for (var aIndex = 0; aIndex < a.length; aIndex++) {
    var currentRow = [aIndex + 1];
    for (var bIndex = 0; bIndex < b.length; bIndex++) {
      var insertCost = currentRow[bIndex] + 1;
      var deleteCost = previousRow[bIndex + 1] + 1;
      var replaceCost = previousRow[bIndex] + (a[aIndex] === b[bIndex] ? 0 : 1);
      currentRow[bIndex + 1] = Math.min(insertCost, deleteCost, replaceCost);
    }
    previousRow = currentRow;
  }

  return previousRow[b.length];
}

function stringSimilarity(a, b) {
  a = normalizeSearchText(a);
  b = normalizeSearchText(b);
  if (a === "" || b === "") {
    return 0;
  }
  if (a === b) {
    return 1;
  }
  if (a.includes(b) || b.includes(a)) {
    return 0.88;
  }
  var maxLength = Math.max(a.length, b.length);
  return 1 - levenshteinDistance(a, b) / maxLength;
}

function calculateSpotifyMatchScore(searchTerm, track, index) {
  var artistNames = track.artists.map((artist) => artist.name);
  var trackName = track.name;
  var fullName = trackName + " " + artistNames.join(" ");
  var queryTokens = getTokens(searchTerm);
  var artistTokens = getTokens(artistNames.join(" "));
  var artistTokenSet = new Set(artistTokens);
  var artistMentioned = queryTokens.some(function (token) {
    return artistTokenSet.has(token);
  });

  var nameScore = stringSimilarity(searchTerm, trackName);
  var fullScore = stringSimilarity(searchTerm, fullName);
  var overlapScore = tokenOverlapScore(searchTerm, fullName);
  var rankPenalty = index * 0.01;
  var score = Math.max(nameScore, fullScore) * 0.55 + overlapScore * 0.35 + (artistMentioned ? 0.1 : 0) - rankPenalty;
  return Math.max(0, Math.min(1, score));
}

function formatSongChoiceMessage(choices) {
  var choiceText = choices.map(function (choice, index) {
    return index + 1 + ") " + shortenText(choice.name, 34) + " - " + shortenText(choice.artists[0] || "Unknown", 20);
  });
  return "Not sure which song you meant. Type !pick 1-" + choices.length + ": " + choiceText.join(" | ");
}

async function createPendingSongChoice(requestContext, choices) {
  var userKey = requestContext.userKey;
  var existingChoice = pendingSongChoices.get(userKey);
  if (existingChoice) {
    clearTimeout(existingChoice.timeoutHandle);
    await refundChannelPoints(existingChoice.requestContext);
  }
  var timeoutHandle = setTimeout(async function () {
    pendingSongChoices.delete(userKey);
    await refundChannelPoints(requestContext);
  }, SONG_CHOICE_TIMEOUT_MS);
  pendingSongChoices.set(userKey, {
    choices: choices,
    requestContext: requestContext,
    timeoutHandle: timeoutHandle,
  });
}

function findPendingSongChoice(chatMessage) {
  var userKey = getUserKey(chatMessage);
  var pendingChoice = pendingSongChoices.get(userKey);
  if (pendingChoice) {
    return { userKey: userKey, pendingChoice: pendingChoice };
  }

  var displayNameKey = chatMessage.displayName.toLowerCase();
  var loginKey = chatMessage.login.toLowerCase();
  var entries = pendingSongChoices.entries();
  for (var entry = entries.next(); !entry.done; entry = entries.next()) {
    var pendingRequestContext = entry.value[1].requestContext;
    if (displayNameKey && pendingRequestContext.displayName && pendingRequestContext.displayName.toLowerCase() === displayNameKey) {
      return { userKey: entry.value[0], pendingChoice: entry.value[1] };
    }
    if (loginKey && pendingRequestContext.login && pendingRequestContext.login.toLowerCase() === loginKey) {
      return { userKey: entry.value[0], pendingChoice: entry.value[1] };
    }
  }

  return null;
}

function getSongChoiceNumber(text) {
  var choiceText = text.trim();
  var botMention = "@" + twitchBotName.toLowerCase();
  if (choiceText.toLowerCase().startsWith(botMention)) {
    choiceText = choiceText.substring(botMention.length).trim();
  }
  if (choiceText.toLowerCase().startsWith("!pick")) {
    choiceText = choiceText.substring("!pick".length).trim();
  }

  var choiceMatch = choiceText.match(/^([1-9])(?:[\).\s-]|$)/);
  if (!choiceMatch) {
    return null;
  }
  return parseInt(choiceMatch[1], 10);
}

async function handlePendingSongChoice(chatMessage) {
  var pendingChoiceEntry = findPendingSongChoice(chatMessage);
  if (!pendingChoiceEntry) {
    return false;
  }
  var pendingChoice = pendingChoiceEntry.pendingChoice;

  var choiceNumber = getSongChoiceNumber(chatMessage.text);
  if (choiceNumber === null) {
    return false;
  }

  if (!isReplyToBot(chatMessage)) {
    console.log("Accepted song choice from the pending requester without Twitch reply-parent bot tags.");
  }

  var choiceIndex = choiceNumber - 1;
  if (Number.isNaN(choiceIndex) || choiceIndex < 0 || choiceIndex >= pendingChoice.choices.length) {
    return false;
  }

  clearTimeout(pendingChoice.timeoutHandle);
  pendingSongChoices.delete(pendingChoiceEntry.userKey);

  var choice = pendingChoice.choices[choiceIndex];
  var response = await spotifyTrack(choice.id, pendingChoice.requestContext);
  sendChatMessage(response, chatMessage.messageId);
  return true;
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

async function spotifySkipToNext() {
  var status = await ensureSpotifyAuth();
  if (!status) {
    return false;
  }

  var result = await fetch("https://api.spotify.com/v1/me/player/next", {
    method: "POST",
    headers: { Authorization: "Bearer " + getSpotifyAccessToken(true) },
  }).then(function (response) {
    return response.status === 204 || response.status === 200;
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

async function refundChannelPoints(requestContext = null) {
  var requestRedemptionId = requestContext ? requestContext.redemptionId : latestRedeem;
  var requestRewardId = requestContext ? requestContext.rewardId : redemptionId;
  if (!requestRedemptionId || !requestRewardId) {
    console.log("Unable to refund channel points because redemption id or reward id is missing.");
    return false;
  }

  var url = "https://api.twitch.tv/helix/channel_points/custom_rewards/redemptions?id=" + requestRedemptionId + "&broadcaster_id=" + twitchBroadcasterId + "&reward_id=" + requestRewardId;
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
  return data.status === 200;
}

async function handleSkipCommand(chatMessage) {
  if (chatMessage.text.trim().toLowerCase() !== "!skip") {
    return false;
  }

  var voterKey = getUserKey(chatMessage);
  if (!skipVoteState) {
    skipVoteState = {
      voters: new Set(),
      timeoutHandle: setTimeout(function () {
        skipVoteState = null;
      }, SKIP_TIMEOUT_MS),
    };
  }

  if (skipVoteState.voters.has(voterKey)) {
    return true;
  }

  skipVoteState.voters.add(voterKey);
  if (skipVoteState.voters.size === 1) {
    sendChatMessage("Skip vote started (1/" + REQUIRED_SKIP_VOTES + ").");
  }

  if (skipVoteState.voters.size >= REQUIRED_SKIP_VOTES) {
    clearTimeout(skipVoteState.timeoutHandle);
    skipVoteState = null;
    var skipped = await spotifySkipToNext();
    if (skipped) {
      sendChatMessage(REQUIRED_SKIP_VOTES + "/" + REQUIRED_SKIP_VOTES + " skip votes. Skipped current song.");
    } else {
      sendChatMessage(REQUIRED_SKIP_VOTES + "/" + REQUIRED_SKIP_VOTES + " skip votes, but Spotify did not skip.");
    }
  }

  return true;
}

function findRecentRedemption(chatMessage) {
  var userKey = getUserKey(chatMessage);
  var now = Date.now();
  recentRedemptions = recentRedemptions.filter(function (redemption) {
    return now - redemption.createdAt < 1000 * 60;
  });

  var redemptionIndex = recentRedemptions.findIndex(function (redemption) {
    var sameUser = redemption.userKey === userKey || redemption.displayNameKey === chatMessage.displayName.toLowerCase() || redemption.loginKey === chatMessage.login.toLowerCase();
    return sameUser && redemption.text === chatMessage.text;
  });
  if (redemptionIndex === -1) {
    return null;
  }

  return recentRedemptions.splice(redemptionIndex, 1)[0];
}

async function waitForRecentRedemption(chatMessage) {
  var startedAt = Date.now();
  var recentRedemption = findRecentRedemption(chatMessage);
  while (!recentRedemption && Date.now() - startedAt < REDEMPTION_MATCH_TIMEOUT_MS) {
    await sleepTime(REDEMPTION_MATCH_INTERVAL_MS);
    recentRedemption = findRecentRedemption(chatMessage);
  }
  return recentRedemption;
}

async function createRequestContext(chatMessage) {
  var recentRedemption = await waitForRecentRedemption(chatMessage);
  return {
    userKey: getUserKey(chatMessage),
    userId: chatMessage.userId,
    displayName: chatMessage.displayName,
    login: chatMessage.login,
    messageId: chatMessage.messageId,
    rewardId: chatMessage.customRewardId || (recentRedemption && recentRedemption.rewardId) || "",
    redemptionId: recentRedemption ? recentRedemption.redemptionId : "",
  };
}

function connectChatBot() {
  var reconnectInterval = 1000 * 3;

  wsChatBot = new WebSocket("wss://irc-ws.chat.twitch.tv:443");

  wsChatBot.onopen = function (event) {
    console.log(event);
    console.log("wsChatBot Socket Opened");
    wsChatBot.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
    wsChatBot.send("PASS oauth:" + getTwitchBotAccessToken(true));
    wsChatBot.send("NICK " + twitchBotName);
    wsChatBot.send("JOIN " + getChatChannel());
  };

  wsChatBot.onmessage = async function (event) {
    console.log(event);
    console.log(event.data);

    var rawMessages = event.data.split("\r\n").filter(function (rawMessage) {
      return rawMessage !== "";
    });

    for (var i = 0; i < rawMessages.length; i++) {
      var rawMessage = rawMessages[i];
      if (rawMessage.startsWith("PING")) {
        wsChatBot.send("PONG :tmi.twitch.tv");
        continue;
      }

      var chatMessage = parseTwitchPrivmsg(rawMessage);
      if (!chatMessage) {
        continue;
      }

      var handledSkip = await handleSkipCommand(chatMessage);
      if (handledSkip) {
        continue;
      }

      var handledChoice = await handlePendingSongChoice(chatMessage);
      if (handledChoice) {
        continue;
      }

      if (chatMessage.customRewardId === twitchChannelRedeemId) {
        console.log("wsChatBot.onmessage: " + rawMessage);
        var requestContext = await createRequestContext(chatMessage);
        var response = await parseSongRequest(chatMessage.text, requestContext);
        sendChatMessage(response, chatMessage.messageId);
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
  var message = {
    type: "PING",
  };
  ws.send(JSON.stringify(message));
}

function listen(ws, topic) {
  var message = {
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
    heartbeatHandle = setInterval(function () {
      heartbeat(wsChannelPoints);
    }, heartbeatInterval);
    console.log("Listening on channel id: " + twitchBroadcasterId);
    listen(wsChannelPoints, "channel-points-channel-v1." + twitchBroadcasterId);
  };

  wsChannelPoints.onmessage = async function (event) {
    var message = JSON.parse(event.data);
    console.log("wsChannelPoints.onmessage: " + message["type"]);
    console.log(message);

    if (message.type == "RECONNECT") {
      console.log("Reconnecting...");
      wsChannelPoints.close();
      return;
    }
    if (message["type"] == "MESSAGE") {
      var messageData = JSON.parse(message["data"]["message"]);
      console.log(messageData);
      var rewardId = messageData["data"]["redemption"]["reward"]["id"];
      if (rewardId == twitchChannelRedeemId) {
        var redemption = messageData["data"]["redemption"];
        redemptionId = redemption["reward"]["id"];
        latestRedeem = redemption["id"];
        var twitchName = redemption["user"]["display_name"];
        var rewardInput = redemption["user_input"];
        recentRedemptions.push({
          userKey: redemption["user"]["id"] || twitchName.toLowerCase(),
          displayNameKey: twitchName.toLowerCase(),
          loginKey: redemption["user"]["login"] ? redemption["user"]["login"].toLowerCase() : "",
          rewardId: redemption["reward"]["id"],
          redemptionId: redemption["id"],
          text: rewardInput,
          createdAt: Date.now(),
        });
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
