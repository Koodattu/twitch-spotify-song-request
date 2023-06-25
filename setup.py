from flask import Flask, request, render_template, redirect
from flask_socketio import SocketIO, emit
from urllib.parse import urlencode
from dotenv import dotenv_values
import os
import base64
import requests
import webbrowser
import socket

# for .env
TWITCH_CLIENT_ID = "TWITCH_CLIENT_ID"
TWITCH_CLIENT_SECRET = "TWITCH_CLIENT_SECRET"
TWITCH_BROADCASTER_OAUTH_TOKEN = "TWITCH_BROADCASTER_OAUTH_TOKEN"
TWITCH_BOT_OAUTH_TOKEN = "TWITCH_BOT_OAUTH_TOKEN"
SPOTIFY_CLIENT_ID = "SPOTIFY_CLIENT_ID"
SPOTIFY_CLIENT_SECRET = "SPOTIFY_CLIENT_SECRET"
TWITCH_REDEEM_REWARD_NAME = "TWITCH_REDEEM_REWARD_NAME"
TWITCH_CHANNEL_NAME = "TWITCH_CHANNEL_NAME"

# for tokens.js
TOKENSJS = "tokens.js"
TWITCHCLIENTID = "twitchClientId"
TWITCHCLIENTSECRET = "twitchClientSecret"
TWITCHBROADCASTERTOKEN = "twitchBroadcasterOAuthToken"
TWITCHBROADCASTERREFRESH = "twitchBroadcasterRefreshToken"
TWITCHBOTTOKEN = "twitchBotOAuthToken"
TWITCHBOTREFRESHTOKEN = "twitchBotRefreshToken"
TWITCHCHANNELREDEEMID = "twitchChannelRedeemId"
SPOTIFYCLIENTID = "spotifyClientId"
SPOTIFYCLIENTSECRET = "spotifyClientSecret"
SPOTIFYTOKEN = "spotifyOAuthToken"
SPOTIFYREFRESH = "spotifyRefreshToken"

# for settings.js
SETTINGSJS = "settings.js"
TWITCHBROADCASTERNAME = "twitchBroadcasterName"
TWITCHBROADCASTERID = "twitchBroadcasterId"
TWITCHBOTNAME = "twitchBotName"
TWITCHBOTID = "twitchBotId"

# for single callback url for both broadcaster and user authentication
broadcasterCallback = True

# for website state tracking
twitch_token_broadcaster_status = ""
twitch_token_bot_status = ""
spotify_token_status = ""
chat_listen_status = ""
twitch_create_reward_status = ""

app = Flask(__name__)
socketio = SocketIO(app)


@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        if (
            "twitch_auth_gen_broadcaster" in request.form
            or "twitch_auth_gen_bot" in request.form
        ):
            twitch_client_id = request.form["twitch_client_id"]
            twitch_client_secret = request.form["twitch_client_secret"]
            twitch_auth_url = (
                generate_twitch_auth_url_redeems(twitch_client_id)
                if "twitch_auth_gen_broadcaster" in request.form
                else generate_twitch_auth_url_chat(twitch_client_id)
            )
            save_env(TWITCH_CLIENT_ID, twitch_client_id)
            save_env(TWITCH_CLIENT_SECRET, twitch_client_secret)
            save_js(TOKENSJS, TWITCHCLIENTID, twitch_client_id)
            save_js(TOKENSJS, TWITCHCLIENTSECRET, twitch_client_secret)
            global broadcasterCallback
            broadcasterCallback = "twitch_auth_gen_broadcaster" in request.form
            return redirect(twitch_auth_url)

        elif "spotify_auth_gen" in request.form:
            spotify_client_id = request.form["spotify_client_id"]
            spotify_client_secret = request.form["spotify_client_secret"]
            spotify_auth_url = generate_spotify_auth_url(spotify_client_id)
            save_env(SPOTIFY_CLIENT_ID, spotify_client_id)
            save_env(SPOTIFY_CLIENT_SECRET, spotify_client_secret)
            save_js(TOKENSJS, SPOTIFYCLIENTID, spotify_client_id)
            save_js(TOKENSJS, SPOTIFYCLIENTSECRET, spotify_client_secret)
            return redirect(spotify_auth_url)

        elif "twitch_create_reward" in request.form:
            twitch_reward_name = request.form["redeem_reward_name"]
            save_env(TWITCH_REDEEM_REWARD_NAME, twitch_reward_name)
            create_redeem_reward(twitch_reward_name)

        elif "twitch_chat_listen" in request.form:
            twitch_channel_name = request.form["twitch_channel_name"]
            save_env(TWITCH_CHANNEL_NAME, twitch_channel_name)
            listen_to_chat(twitch_channel_name)

        elif "save_channel_redeem_id" in request.form:
            twitch_redeem_id = request.form["twitch_channel_redeem"]
            save_js(TOKENSJS, SPOTIFYTOKEN, twitch_redeem_id)

    return render_template(
        "index.html",
        twitch_client_id=read_env(TWITCH_CLIENT_ID),
        twitch_client_secret=read_env(TWITCH_CLIENT_SECRET),
        spotify_client_id=read_env(SPOTIFY_CLIENT_ID),
        spotify_client_secret=read_env(SPOTIFY_CLIENT_SECRET),
        twitch_channel_name=read_env(TWITCH_CHANNEL_NAME),
        redeem_reward_name=read_env(TWITCH_REDEEM_REWARD_NAME),
        twitch_token_status_broadcaster_label=twitch_token_broadcaster_status,
        twitch_token_status_bot_label=twitch_token_bot_status,
        spotify_token_status_label=spotify_token_status,
        chat_listen_status_label=chat_listen_status,
        twitch_create_reward_status_label=twitch_create_reward_status,
    )


@app.route("/twitch/callback")
def twitch_callback():
    code = request.args.get(
        "code"
    )  # Get the authorization code from the query parameters
    if code:
        # Make a POST request to Twitch to exchange the authorization code for an access token
        client_id = read_env(TWITCH_CLIENT_ID)
        client_secret = read_env(TWITCH_CLIENT_SECRET)
        data = {
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": "http://localhost:5000/twitch/callback",  # Must match the redirect URI set in your Twitch application settings
        }
        response = requests.post("https://id.twitch.tv/oauth2/token", data=data)
        if response.status_code == 200:
            # Access token retrieved successfully
            access_token = response.json()["access_token"]
            refresh_token = response.json()["refresh_token"]

            url = "https://api.twitch.tv/helix/users"
            headers = {
                "Client-ID": client_id,
                "Authorization": f"Bearer {access_token}",
            }

            global twitch_token_broadcaster_status
            global twitch_token_bot_status
            global broadcasterCallback
            # Get the Twitch user ID associated with the OAuth token
            response = requests.get(url, headers=headers)
            if response.status_code != 200:
                if broadcasterCallback:
                    twitch_token_broadcaster_status = (
                        "Failed to acquire authorization token."
                    )
                else:
                    twitch_token_bot_status = "Failed to acquire authorization token."
                return

            twitch_name = response.json()["data"][0]["display_name"]
            twitch_id = response.json()["data"][0]["id"]

            # Do something with the access token (e.g., store it for future use)
            if broadcasterCallback:
                save_env(TWITCH_BROADCASTER_OAUTH_TOKEN, access_token)
                save_js(TOKENSJS, TWITCHBROADCASTERTOKEN, access_token)
                save_js(TOKENSJS, TWITCHBROADCASTERREFRESH, refresh_token)
                save_js(SETTINGSJS, TWITCHBROADCASTERNAME, twitch_name)
                save_js(SETTINGSJS, TWITCHBROADCASTERID, twitch_id)
                twitch_token_broadcaster_status = (
                    f'Acquired access token for "{twitch_name}".'
                )
            else:
                save_env(TWITCH_BOT_OAUTH_TOKEN, access_token)
                save_js(TOKENSJS, TWITCHBOTTOKEN, access_token)
                save_js(TOKENSJS, TWITCHBOTREFRESHTOKEN, refresh_token)
                save_js(SETTINGSJS, TWITCHBOTNAME, twitch_name)
                save_js(SETTINGSJS, TWITCHBOTID, twitch_id)
                twitch_token_bot_status = f'Acquired access token for "{twitch_name}".'

        else:
            # Authorization failed
            if broadcasterCallback:
                twitch_token_broadcaster_status = (
                    "Failed to acquire authorization token."
                )
            else:
                twitch_token_bot_status = "Failed to acquire authorization token."

    return redirect("http://localhost:5000/")


@app.route("/spotify/callback")
def callback():
    token_url = "https://accounts.spotify.com/api/token"
    code = request.args.get(
        "code"
    )  # Get the authorization code from the query parameters

    client_id = read_env(SPOTIFY_CLIENT_ID)
    client_secret = read_env(SPOTIFY_CLIENT_SECRET)

    headers = {
        "Authorization": "Basic "
        + base64.b64encode((client_id + ":" + client_secret).encode()).decode(),
        "Content-Type": "application/x-www-form-urlencoded",
    }

    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": "http://localhost:5000/spotify/callback",
    }

    response = requests.post(token_url, headers=headers, data=data)
    if response.status_code == 200:
        response_data = response.json()
        access_token = response_data["access_token"]
        refresh_token = response_data["refresh_token"]

        save_js(TOKENSJS, SPOTIFYTOKEN, access_token)
        save_js(TOKENSJS, SPOTIFYREFRESH, refresh_token)

        global spotify_token_status
        spotify_token_status = "Acquired access token."
    else:
        spotify_token_status = "Failed to acquire authorization token."

    return redirect("http://localhost:5000/")


def listen_to_chat(channel_name):
    twitch_client_id = read_env(TWITCH_CLIENT_ID)
    oauth_token = read_env(TWITCH_BOT_OAUTH_TOKEN)

    url = "https://api.twitch.tv/helix/users"
    headers = {"Client-ID": twitch_client_id, "Authorization": f"Bearer {oauth_token}"}

    # Get the Twitch user ID associated with the OAuth token
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        global chat_listen_status
        chat_listen_status = "Failed to listen to chat."
        return

    user_name = response.json()["data"][0]["display_name"]
    user_id = response.json()["data"][0]["id"]

    save_js(SETTINGSJS, TWITCHBROADCASTERNAME, user_name)
    save_js(SETTINGSJS, TWITCHBROADCASTERID, user_id)

    sock = socket.socket()
    sock.connect(("irc.chat.twitch.tv", 6667))
    # sock.connect("ws://irc-ws.chat.twitch.tv:80")
    sock.send("CAP REQ : twitch.tv/tags twitch.tv/commands\n".encode("utf-8"))
    sock.send(f"PASS oauth:{oauth_token}\n".encode("utf-8"))
    sock.send(f"NICK {user_name}\n".encode("utf-8"))
    sock.send(f"JOIN #{channel_name}\n".encode("utf-8"))

    socketio.emit(
        "chat_listening", {"message": f"Listening to {channel_name}!"}, namespace="/"
    )

    while True:
        resp = sock.recv(2048).decode("utf-8")
        if resp.startswith("PING"):
            sock.send("PONG\n".encode("utf-8"))
        elif "PRIVMSG" in resp:
            if "custom-reward-id" in resp:
                # Extract the message ID from the received response
                msg_parts = resp.split(";")
                reward_id = msg_parts[3].split("=")[1]
                display_name = msg_parts[4].split("=")[1]
                save_js(SETTINGSJS, TWITCHCHANNELREDEEMID, reward_id)
                # Emit the message ID through the socket connection to the client
                socketio.emit("channel_redeem", {"reward_id": reward_id}, namespace="/")
                socketio.emit(
                    "redeemed_by", {"display_name": display_name}, namespace="/"
                )


def create_redeem_reward(reward_name):
    twitch_client_id = read_env(TWITCH_CLIENT_ID)
    oauth_token = read_env(TWITCH_BROADCASTER_OAUTH_TOKEN)

    url = "https://api.twitch.tv/helix/users"
    headers = {"Client-ID": twitch_client_id, "Authorization": f"Bearer {oauth_token}"}

    global twitch_create_reward_status
    # Get the Twitch user ID associated with the OAuth token
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        twitch_create_reward_status = "Reward creation failed: "
        return

    channel_id = response.json()["data"][0]["id"]

    url = f"https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id={channel_id}"
    headers = {
        "Client-ID": twitch_client_id,
        "Authorization": f"Bearer {oauth_token}",
        "Content-Type": "application/json",
    }

    # Get the Twitch user ID associated with the OAuth token
    data = {"title": reward_name, "cost": 1, "is_user_input_required": True}

    response = requests.post(url, headers=headers, json=data)
    if response.status_code == 200:
        redeem_reward_id = response.json()["data"][0]["id"]
        save_js(SETTINGSJS, TWITCHCHANNELREDEEMID, redeem_reward_id)
        twitch_create_reward_status = "Reward created succesfully!"
    else:
        twitch_create_reward_status = (
            "Reward creation failed: " + response.json()["message"]
        )


def generate_twitch_auth_url_chat(clientId):
    params = {
        "client_id": clientId,
        "redirect_uri": "http://localhost:5000/twitch/callback",  # Must match the redirect URI set in your Twitch application settings
        "response_type": "code",
        "scope": "chat%3Aread+chat%3Aedit",  # e.g., 'user_read' for basic user information access
    }
    url = "https://id.twitch.tv/oauth2/authorize?" + "&".join(
        [f"{key}={value}" for key, value in params.items()]
    )
    return url


def generate_twitch_auth_url_redeems(clientId):
    params = {
        "client_id": clientId,
        "redirect_uri": "http://localhost:5000/twitch/callback",  # Must match the redirect URI set in your Twitch application settings
        "response_type": "code",
        "scope": "channel%3Aread%3Aredemptions+channel%3Amanage%3Aredemptions",  # e.g., 'user_read' for basic user information access
    }
    url = "https://id.twitch.tv/oauth2/authorize?" + "&".join(
        [f"{key}={value}" for key, value in params.items()]
    )
    return url


def generate_spotify_auth_url(clientId):
    params = {
        "response_type": "code",
        "client_id": clientId,
        "scope": "user-modify-playback-state",
        "redirect_uri": "http://localhost:5000/spotify/callback",
    }
    url = "https://accounts.spotify.com/authorize?" + urlencode(params)
    return url


def read_env(env_variable_name):
    if not os.path.exists(".env"):
        return ""

    env_values = dotenv_values(".env")
    if not env_variable_name in env_values.keys():
        return ""

    return env_values[env_variable_name]


def save_env(env_variable_name, env_variable_value):
    env_values = {}
    if os.path.exists(".env"):
        env_values = dotenv_values(".env")

    env_values[env_variable_name] = env_variable_value

    with open(".env", "w") as file:
        for key, value in env_values.items():
            file.write(f"{key}={value}\n")


def save_js(fileName, variable, value):
    lines = []

    if os.path.exists(fileName):
        with open(fileName, "r") as file:
            lines = file.readlines()

    index = [idx for idx, s in enumerate(lines) if variable in s]
    if len(index) == 0:
        lines.append(f'const {variable} = "{value}";\n')
    else:
        lines[index[0]] = f'const {variable} = "{value}";\n'

    with open(fileName, "w") as file:
        file.writelines(lines)


if __name__ == "__main__":
    webbrowser.open("http://localhost:5000/")
    app.run()
