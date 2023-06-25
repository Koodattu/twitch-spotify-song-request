<div align="center">
    <br />
    <img src="https://i.imgur.com/5CMSS48.png" alt="Logo" width="80" height="80">

  <h3 align="center">Twitch & Spotify Song Request Script</h3>

  <p align="center">
   A simple script for Spotify song requests from Twitch channel points redeems 
    <br />
    <br />
  </p>
</div>

## Project description

This repository houses a personal project designed to handle Twitch song request channel points redeem rewards and seamlessly add the requested songs to a Spotify queue. The primary objective of this project was to develop a straightforward local HTML file with embedded JavaScript, encompassing all the essential logic required to manage Twitch and Spotify API calls. It eliminates the need for hosting and can be conveniently added as a browser source to OBS.

The Twitch API is utilized to monitor channel points reward redeems, respond in chat, refund utilized channel points, and refresh access tokens. On the other hand, the Spotify API is employed to search for songs, add them to the queue, and refresh access tokens.

OAuth tokens are essential and need to be generated for the initial run using a hosted solution that can receive callbacks containing the first access and refresh tokens. Additionally, this repository includes a Python Flask script that serves as a straightforward server for generating the initial tokens.

### Key Features
* Connect to broadcaster and bot Twitch accounts
* Create new song request channel points redeem reward
* Add song to Spotify queue from channel points redeem reward text input
  * Supports both text search and Spotify url link 
* Refund channel points if unable to add song to queue
* Replies in chat with the name of the song that was added to the queue or if song request failed and channel points were refunded

## Requirements

* Twitch account with channel points redeem rewards enabled
* Bot account that will reply in chat (you can also use your main Twitch account if you so wish)
* Spotify Premium account

## How to setup

* Install [Python](https://www.python.org/downloads/)
* [Download](https://github.com/Koodattu/twitch-spotify-song-request/archive/refs/heads/main.zip) the repository and extract it into a folder
* Run `pip install -r requirements.txt` with command line inside the folder
* Run `python setup.py` inside the folder
  * A new browser window or tab should open, if not, navigate to `http://localhost:5000/`
* Create a new Twitch app on the [Twitch Developer Console](https://dev.twitch.tv/console)
  * Name can be whatever
  * Set redirect url to `http://localhost:5000/twitch/callback`
  * Category can be **Application Integration** or **Chat Bot**
  * Create the app and click on **Manage**
  * Click on **Create a New Secret**
  * Copy both **Client Id** and **Client Secret** to the previously opened webpage
  * Click on **Generate OAuth Token** to generate tokens for the broadcaster and bot accounts
    * You can open the webpage on another browser or in incognito and log in to the bot account there
* Create a new channel points redeem reward using the webpage
  * You can modify the channel point reward on your [Twitch Dashboard](https://dashboard.twitch.tv/u/vaarattu/viewer-rewards/channel-points/rewards)
* Create a new Spotify app on the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
  * App name and description can be whatever
  * Set website and Redirect URI to `http://localhost:5000/spotify/callback`
  * Click create and click on **Settings**
  * Click **View Client Secret** and copy both **Client Id** and **Client Secret** to previously opened webpage
  * Click **Generate OAuth Token** for Spotify
* Close the Python script
* Add the `Index.html` file to OBS as a **Browser Source**

## Authors

Juha Ala-Rantala ([Koodattu](https://github.com/Koodattu/))

## Version History

* 1.0.0
    * Initial release

## Tools used

* Visual Studio Code

## License

Distributed under the MIT License. See `LICENSE` file for more information.

## Resources used

[Twitch Developer API](https://dev.twitch.tv/docs/api/)

[Spotify Developer API](https://developer.spotify.com/documentation/web-api)
