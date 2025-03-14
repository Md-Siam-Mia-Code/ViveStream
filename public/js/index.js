<<<<<<< HEAD
// Media state management
let currentTrackIndex = -1;
let tracks = [];
let isPlaying = false;
let isShuffled = false;
let isLooped = false;
let isFullscreen = false;
let isVideoView = true;
let previousVolume = 1;
let isMuted = false;
let eventSource = null;
let selectedResolution = '144p';
let playNextQueue = [];
let playlists = JSON.parse(localStorage.getItem('playlists')) || [];

// Media elements
const audio = new Audio();
const video = document.getElementById('videoPlayer');
const videoContainer = document.querySelector('.custom-video-container');
const progressBar = document.querySelector('.progress-bar');
const progressKnob = document.querySelector('.progress-knob');
const nowPlayingContainer = document.getElementById('nowPlaying');
const playerTitle = document.getElementById('playerTitle');
const playerThumb = document.getElementById('playerThumb');
const upNextContainer = document.getElementById('upNextContainer');

// Initialize player
function initPlayer() {
    video.controls = false;

    audio.addEventListener('timeupdate', updateProgressBar);
    video.addEventListener('timeupdate', updateProgressBar);

    audio.addEventListener('ended', () => { if (!isLooped) playNextTrack(); });
    video.addEventListener('ended', () => { if (!isLooped) playNextTrack(); });

    document.addEventListener('keydown', handleKeyboardShortcuts);
    setupProgressDrag();

    videoContainer.style.display = 'none';

    // Load volume from local storage
    const savedVolume = localStorage.getItem('volume');
    if (savedVolume !== null) {
        setVolume(savedVolume);
    }

    // Close dropdowns on outside click
    document.addEventListener('click', (event) => {
        if (!event.target.closest('.hamburger-menu')) {
            document.querySelectorAll('.dropdown-menu').forEach(menu => menu.style.display = 'none');
        }
    });
}

// Toggle play/pause
function togglePlay() {
    if (audio.paused && video.paused) {
        playMedia();
    } else {
        pauseMedia();
    }
}

function playMedia() {
    if (currentTrackIndex < 0 && tracks.length > 0) {
        playTrackByIndex(0);
        return;
    }
    if (currentTrackIndex < 0) return;

    audio.play();
    if (tracks[currentTrackIndex].videoUrl) video.play();
    isPlaying = true;
    updatePlayPauseIcons();
}

function pauseMedia() {
    audio.pause();
    video.pause();
    isPlaying = false;
    updatePlayPauseIcons();
}

function updatePlayPauseIcons() {
    const playPauseIcons = document.querySelectorAll('.play-pause i');
    const videoOverlayIcon = document.querySelector('.video-overlay .play-icon i');
    playPauseIcons.forEach(icon => icon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play');
    videoOverlayIcon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
}

// Skip forward/backward
function skip(seconds) {
    if (currentTrackIndex < 0) return;
    const newTime = Math.min(Math.max(0, audio.currentTime + seconds), audio.duration);
    audio.currentTime = newTime;
    if (tracks[currentTrackIndex].videoUrl) video.currentTime = newTime;
}

// Toggle mute
function toggleMute() {
    if (audio.volume > 0) {
        previousVolume = audio.volume;
        setVolume(0);
        isMuted = true;
    } else {
        setVolume(previousVolume);
        isMuted = false;
    }
}

// Set volume
function setVolume(volume) {
    audio.volume = volume;
    video.volume = volume;
    document.querySelector('.volume-slider').value = volume;
    const volumeIcon = document.getElementById('volumeIcon');
    volumeIcon.className = volume == 0 ? 'fas fa-volume-mute' : volume < 0.5 ? 'fas fa-volume-down' : 'fas fa-volume-up';
    isMuted = volume == 0;
    localStorage.setItem('volume', volume);
}

// Toggle shuffle
function toggleShuffle() {
    isShuffled = !isShuffled;
    document.getElementById('shuffleBtn').classList.toggle('active', isShuffled);
    updateUpNextList();
}

// Toggle loop
function toggleLoop() {
    isLooped = !isLooped;
    audio.loop = isLooped;
    video.loop = isLooped;
    document.getElementById('loopBtn').classList.toggle('active', isLooped);
}

// Seek to position
function seek(event) {
    if (currentTrackIndex < 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const pos = (event.clientX - rect.left) / rect.width;
    const newTime = pos * audio.duration;
    audio.currentTime = newTime;
    if (tracks[currentTrackIndex].videoUrl) video.currentTime = newTime;
}

// Setup draggable progress
function setupProgressDrag() {
    const progressContainer = document.querySelector('.progress-container');
    progressContainer.addEventListener('mousedown', function (e) {
        const handleMouseMove = (e) => seek(e);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', () => document.removeEventListener('mousemove', handleMouseMove), { once: true });
    });
}

// Update progress bar
function updateProgressBar() {
    if (currentTrackIndex < 0 || isNaN(audio.duration)) return;
    const progress = (audio.currentTime / audio.duration) * 100;
    progressBar.style.width = `${progress}%`;
    progressKnob.style.left = `${progress}%`;
    document.getElementById('currentTime').textContent = formatTime(audio.currentTime);
    document.getElementById('duration').textContent = formatTime(audio.duration);
}

// Toggle fullscreen
function toggleFullscreen() {
    if (!isFullscreen) {
        videoContainer.requestFullscreen?.() || videoContainer.mozRequestFullScreen?.() || videoContainer.webkitRequestFullscreen?.() || videoContainer.msRequestFullscreen?.();
        document.querySelector('.fullscreen-btn i').className = 'fas fa-compress';
    } else {
        document.exitFullscreen?.() || document.mozCancelFullScreen?.() || document.webkitExitFullscreen?.() || document.msExitFullscreen?.();
        document.querySelector('.fullscreen-btn i').className = 'fas fa-expand';
    }
    isFullscreen = !isFullscreen;
}

// Toggle between video and audio view
function toggleMediaView() {
    if (!tracks[currentTrackIndex]?.videoUrl) return;
    document.body.classList.toggle('video-player-active');
    isVideoView = document.body.classList.contains('video-player-active');
    document.querySelector('.media-toggle-btn i').className = isVideoView ? 'fas fa-music' : 'fas fa-tv';
    updateUpNextList();
}

// Format time (seconds to mm:ss)
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Play track by index
function playTrackByIndex(index) {
    if (!tracks.length || index < 0 || index >= tracks.length) return;
    currentTrackIndex = index;
    const track = tracks[index];

    audio.src = track.audioUrl;
    if (track.videoUrl) {
        video.src = track.videoUrl;
        videoContainer.style.display = 'block';
        document.body.classList.add('video-player-active');
        isVideoView = true;
    } else {
        video.src = '';
        videoContainer.style.display = 'none';
        document.body.classList.remove('video-player-active');
        isVideoView = false;
    }

    playerTitle.textContent = track.title;
    playerThumb.src = track.cover;
    document.getElementById('player').classList.add('player-active');
    updateNowPlaying(track);
    updateUpNextList();

    audio.play();
    if (track.videoUrl) video.play();
    isPlaying = true;
    updatePlayPauseIcons();
}

// Update now playing information
function updateNowPlaying(track) {
    if (!track) return;
    nowPlayingContainer.innerHTML = `
        <button class="back-to-video-btn" onclick="toggleMediaView()" aria-label="Back to Video">
            <i class="fas fa-tv"></i>
        </button>
        <img src="${track.cover}" alt="${track.title}">
        <div>
            <h3>${track.title}</h3>
            <p>Now Playing</p>
        </div>
    `;
    nowPlayingContainer.classList.add('now-playing-active');
}

// Play next track
function playNextTrack() {
    if (playNextQueue.length > 0) {
        const nextIndex = playNextQueue.shift();
        playTrackByIndex(nextIndex);
    } else if (!tracks.length) {
        return;
    } else {
        let nextIndex = isShuffled ?
            Math.floor(Math.random() * tracks.length) :
            (currentTrackIndex + 1) % tracks.length;
        playTrackByIndex(nextIndex);
    }
}

// Play previous track
function playPrevTrack() {
    if (!tracks.length) return;
    let prevIndex = isShuffled ?
        Math.floor(Math.random() * tracks.length) :
        (currentTrackIndex - 1 + tracks.length) % tracks.length;
    playTrackByIndex(prevIndex);
}

// Keyboard shortcuts
function handleKeyboardShortcuts(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    switch (e.key) {
        case ' ': e.preventDefault(); togglePlay(); break;
        case 'ArrowRight': skip(10); break;
        case 'ArrowLeft': skip(-10); break;
        case 'ArrowUp': e.preventDefault(); setVolume(Math.min(1, audio.volume + 0.1)); break;
        case 'ArrowDown': e.preventDefault(); setVolume(Math.max(0, audio.volume - 0.1)); break;
        case 'f': toggleFullscreen(); break;
        case 'm': toggleMute(); break;
        case 'n': playNextTrack(); break;
        case 'p': playPrevTrack(); break;
        case 'l': toggleLoop(); break;
        case 's': toggleShuffle(); break;
        case 'v': if (tracks[currentTrackIndex]?.videoUrl) toggleMediaView(); break;
    }
}

// Toggle dropdown
function toggleDropdown() {
    const dropdownContent = document.getElementById('dropdownContent');
    dropdownContent.style.display = dropdownContent.style.display === 'block' ? 'none' : 'block';
}

// Select resolution
function selectResolution(resolution) {
    selectedResolution = resolution;
    document.getElementById('selectedResolution').textContent = resolution;
    toggleDropdown();
}

// Download a track from YouTube
function downloadTrack() {
    const url = document.getElementById('urlInput').value.trim();
    if (!url) {
        showAlert('Please enter a valid YouTube URL', 'error');
        return;
    }

    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubeRegex.test(url)) {
        showAlert('Please enter a valid YouTube URL', 'error');
        return;
    }

    const alert = showAlert('Downloading... This may take a minute', 'progress');
    if (eventSource) eventSource.close();

    eventSource = new EventSource(`/download?url=${encodeURIComponent(url)}&resolution=${selectedResolution}`);
    eventSource.onmessage = function (event) {
        const data = JSON.parse(event.data);
        if (data.type === 'progress') {
            alert.querySelector('.progress-bar-inner').style.width = `${data.progress}%`;
            alert.querySelector('span').textContent = data.message;
        } else if (data.type === 'complete') {
            const track = {
                id: data.id,
                title: data.title,
                audioUrl: data.audio,
                videoUrl: data.video,
                cover: data.cover
            };
            tracks.push(track);
            updateTracksList();
            saveTracksToStorage();
            showAlert('Track downloaded successfully!', 'success');
            document.getElementById('urlInput').value = '';
            if (tracks.length === 1) playTrackByIndex(0);
            eventSource.close();
            eventSource = null;
        } else if (data.type === 'error') {
            showAlert(data.message, 'error');
            eventSource.close();
            eventSource = null;
        }
    };

    eventSource.onerror = function () {
        showAlert('Download failed. Please try again.', 'error');
        eventSource.close();
        eventSource = null;
    };
}

// Update tracks list in UI
function updateTracksList() {
    const container = document.getElementById('tracksContainer');
    if (!tracks.length) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-music"></i>
                <h3>No tracks yet</h3>
                <p>Enter a YouTube URL above to download and play your favorite tracks</p>
            </div>
        `;
        upNextContainer.innerHTML = '';
        return;
    }

    container.innerHTML = '';
    tracks.forEach((track, index) => {
        const card = document.createElement('div');
        card.className = 'track-card';
        card.innerHTML = `
            <div class="track-card-image">
                <img src="${track.cover}" alt="${track.title}">
            </div>
            <div class="track-info">
                <div>
                    <h3>${track.title}</h3>
                    <small>${formatTrackNumber(index + 1)}</small>
                </div>
                <div class="hamburger-menu" onclick="toggleTrackMenu(event, ${index})">
                    <div class="bar"></div>
                    <div class="bar"></div>
                    <div class="bar"></div>
                    <div class="dropdown-menu">
                        <div class="dropdown-item" onclick="addToPlaylist(${index})">Add to Playlist</div>
                        <div class="dropdown-item" onclick="playNext(${index})">Play Next</div>
                        <div class="dropdown-item" onclick="renameTrack(${index})">Rename Track</div>
                        <div class="dropdown-item" onclick="removeTrack(${index})">Delete Track</div>
                    </div>
                </div>
            </div>
        `;
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.hamburger-menu')) playTrackByIndex(index);
        });
        container.appendChild(card);
    });
    updateUpNextList();
}

// Toggle track menu
function toggleTrackMenu(event, index) {
    event.stopPropagation();
    const menu = event.currentTarget.querySelector('.dropdown-menu');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

// Add to playlist
function addToPlaylist(index) {
    const track = tracks[index];
    let options = 'Choose a playlist:\n';
    playlists.forEach((p, i) => options += `${i + 1}. ${p.name}\n`);
    options += `${playlists.length + 1}. Create new playlist`;

    const choice = prompt(options);
    if (!choice) return;

    const choiceNum = parseInt(choice);
    if (choiceNum >= 1 && choiceNum <= playlists.length) {
        const playlist = playlists[choiceNum - 1];
        if (!playlist.tracks.includes(track.id)) {
            playlist.tracks.push(track.id);
            localStorage.setItem('playlists', JSON.stringify(playlists));
            showAlert(`Added to ${playlist.name}`, 'success');
        } else {
            showAlert('Track already in playlist', 'error');
        }
    } else if (choiceNum === playlists.length + 1) {
        const playlistName = prompt('Enter new playlist name:');
        if (playlistName) {
            const newPlaylist = { name: playlistName, tracks: [track.id] };
            playlists.push(newPlaylist);
            localStorage.setItem('playlists', JSON.stringify(playlists));
            showAlert(`Created and added to ${playlistName}`, 'success');
        }
    } else {
        showAlert('Invalid choice', 'error');
    }
}

// Play next
function playNext(index) {
    if (index === currentTrackIndex) return;
    playNextQueue.unshift(index);
    showAlert('Track will play next', 'success');
}

// Rename track
function renameTrack(index) {
    const newTitle = prompt('Enter new track title:', tracks[index].title);
    if (newTitle && newTitle !== tracks[index].title) {
        const track = tracks[index];
        fetch('/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: track.id, newTitle })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                track.title = newTitle;
                track.audioUrl = data.audioUrl;
                track.videoUrl = data.videoUrl;
                track.cover = data.cover;
                updateTracksList();
                if (currentTrackIndex === index) {
                    playerTitle.textContent = newTitle;
                    nowPlayingContainer.querySelector('h3').textContent = newTitle;
                }
                showAlert('Track renamed successfully', 'success');
            } else {
                showAlert('Failed to rename track', 'error');
            }
        })
        .catch(error => {
            console.error('Error renaming track:', error);
            showAlert('Failed to rename track', 'error');
        });
    }
}

// Remove track
function removeTrack(index) {
    const track = tracks[index];
    if (confirm(`Are you sure you want to delete "${track.title}"?`)) {
        fetch('/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: track.id })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (index === currentTrackIndex) {
                    pauseMedia();
                    currentTrackIndex = -1;
                    document.getElementById('player').classList.remove('player-active');
                }
                tracks.splice(index, 1);
                updateTracksList();
                saveTracksToStorage();
                showAlert('Track deleted successfully', 'success');
            } else {
                showAlert('Failed to delete track', 'error');
            }
        })
        .catch(error => {
            console.error('Error deleting track:', error);
            showAlert('Failed to delete track', 'error');
        });
    }
}

// Update Up Next list
function updateUpNextList() {
    upNextContainer.innerHTML = '<h2>Up Next</h2>';
    if (currentTrackIndex < 0 || isShuffled || !isVideoView) {
        upNextContainer.style.display = 'none';
        return;
    }

    for (let i = currentTrackIndex + 1; i < tracks.length; i++) {
        const track = tracks[i];
        const card = document.createElement('div');
        card.className = 'upnext-card';
        card.innerHTML = `
            <img src="${track.cover}" alt="${track.title}">
            <div class="track-info">
                <h3>${track.title}</h3>
                <small>${formatTrackNumber(i + 1)}</small>
            </div>
        `;
        upNextContainer.appendChild(card);
    }
}

// Format track number
function formatTrackNumber(num) {
    return `Track ${num < 10 ? '0' : ''}${num}`;
}

// Show alert
function showAlert(message, type) {
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());

    const alert = document.createElement('div');
    alert.className = `alert ${type}`;
    const icon = type === 'error' ? 'fa-exclamation-circle' : type === 'success' ? 'fa-check-circle' : 'fa-spinner';
    alert.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
        ${type === 'progress' ? '<div class="progress-bar-container"><div class="progress-bar-inner"></div></div>' : ''}
    `;
    document.body.appendChild(alert);

    if (type !== 'progress') {
        setTimeout(() => {
            alert.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => alert.remove(), 300);
        }, 4000);
    }
    return alert;
}

// Load tracks from server and local storage
function loadTracks() {
    fetch('/tracks')
        .then(response => response.json())
        .then(serverTracks => {
            const localTracks = JSON.parse(localStorage.getItem('ytune_tracks') || '[]');
            tracks = serverTracks.map(track => ({
                id: track.id,
                title: track.title,
                audioUrl: track.audio,
                videoUrl: track.video,
                cover: track.cover
            }));
            localTracks.forEach(localTrack => {
                if (!tracks.some(t => t.id === localTrack.id)) tracks.push(localTrack);
            });
            updateTracksList();
            saveTracksToStorage();
        })
        .catch(error => {
            console.error('Error loading tracks from server:', error);
            tracks = JSON.parse(localStorage.getItem('ytune_tracks') || '[]');
            updateTracksList();
        });
}

// Save tracks to local storage
function saveTracksToStorage() {
    localStorage.setItem('ytune_tracks', JSON.stringify(tracks));
    localStorage.setItem('playlists', JSON.stringify(playlists));
}

// Show custom confirmation prompt
function showConfirmPrompt(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const yesBtn = document.getElementById('confirmYes');
        const noBtn = document.getElementById('confirmNo');
        const messageEl = modal.querySelector('p');

        messageEl.textContent = message;
        modal.style.display = 'flex';

        const cleanup = () => {
            modal.style.display = 'none';
            yesBtn.removeEventListener('click', handleYes);
            noBtn.removeEventListener('click', handleNo);
        };

        const handleYes = () => {
            cleanup();
            resolve(true);
        };

        const handleNo = () => {
            cleanup();
            resolve(false);
        };

        yesBtn.addEventListener('click', handleYes);
        noBtn.addEventListener('click', handleNo);
    });
}

// Clear all localStorage data with custom prompt
async function clearCache() {
    const confirmed = await showConfirmPrompt('Are you sure you want to clear all cached data? This will reset playlists and locally stored tracks.');
    if (confirmed) {
        localStorage.clear();
        tracks = [];
        currentTrackIndex = -1;
        playNextQueue = [];
        playlists = [];
        pauseMedia();
        document.getElementById('player').classList.remove('player-active');
        nowPlayingContainer.classList.remove('now-playing-active');
        updateTracksList();
        showAlert('Cache cleared successfully', 'success');
    }
}

// Initialize on page load
window.addEventListener('load', () => {
    initPlayer();
    loadTracks();
    window.addEventListener('beforeunload', saveTracksToStorage);
});

document.addEventListener('fullscreenchange', () => {
    isFullscreen = !!document.fullscreenElement;
    document.querySelector('.fullscreen-btn i').className = isFullscreen ? 'fas fa-compress' : 'fas fa-expand';
=======
// Media state management
let currentTrackIndex = -1;
let tracks = [];
let isPlaying = false;
let isShuffled = false;
let isLooped = false;
let isFullscreen = false;
let isVideoView = true;
let previousVolume = 1;
let isMuted = false;
let eventSource = null;
let selectedResolution = '144p';
let playNextQueue = [];
let playlists = JSON.parse(localStorage.getItem('playlists')) || [];

// Media elements
const audio = new Audio();
const video = document.getElementById('videoPlayer');
const videoContainer = document.querySelector('.custom-video-container');
const progressBar = document.querySelector('.progress-bar');
const progressKnob = document.querySelector('.progress-knob');
const nowPlayingContainer = document.getElementById('nowPlaying');
const playerTitle = document.getElementById('playerTitle');
const playerThumb = document.getElementById('playerThumb');
const upNextContainer = document.getElementById('upNextContainer');

// Initialize player
function initPlayer() {
    video.controls = false;

    audio.addEventListener('timeupdate', updateProgressBar);
    video.addEventListener('timeupdate', updateProgressBar);

    audio.addEventListener('ended', () => { if (!isLooped) playNextTrack(); });
    video.addEventListener('ended', () => { if (!isLooped) playNextTrack(); });

    document.addEventListener('keydown', handleKeyboardShortcuts);
    setupProgressDrag();

    videoContainer.style.display = 'none';

    // Load volume from local storage
    const savedVolume = localStorage.getItem('volume');
    if (savedVolume !== null) {
        setVolume(savedVolume);
    }

    // Close dropdowns on outside click
    document.addEventListener('click', (event) => {
        if (!event.target.closest('.hamburger-menu')) {
            document.querySelectorAll('.dropdown-menu').forEach(menu => menu.style.display = 'none');
        }
    });
}

// Toggle play/pause
function togglePlay() {
    if (audio.paused && video.paused) {
        playMedia();
    } else {
        pauseMedia();
    }
}

function playMedia() {
    if (currentTrackIndex < 0 && tracks.length > 0) {
        playTrackByIndex(0);
        return;
    }
    if (currentTrackIndex < 0) return;

    audio.play();
    if (tracks[currentTrackIndex].videoUrl) video.play();
    isPlaying = true;
    updatePlayPauseIcons();
}

function pauseMedia() {
    audio.pause();
    video.pause();
    isPlaying = false;
    updatePlayPauseIcons();
}

function updatePlayPauseIcons() {
    const playPauseIcons = document.querySelectorAll('.play-pause i');
    const videoOverlayIcon = document.querySelector('.video-overlay .play-icon i');
    playPauseIcons.forEach(icon => icon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play');
    videoOverlayIcon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
}

// Skip forward/backward
function skip(seconds) {
    if (currentTrackIndex < 0) return;
    const newTime = Math.min(Math.max(0, audio.currentTime + seconds), audio.duration);
    audio.currentTime = newTime;
    if (tracks[currentTrackIndex].videoUrl) video.currentTime = newTime;
}

// Toggle mute
function toggleMute() {
    if (audio.volume > 0) {
        previousVolume = audio.volume;
        setVolume(0);
        isMuted = true;
    } else {
        setVolume(previousVolume);
        isMuted = false;
    }
}

// Set volume
function setVolume(volume) {
    audio.volume = volume;
    video.volume = volume;
    document.querySelector('.volume-slider').value = volume;
    const volumeIcon = document.getElementById('volumeIcon');
    volumeIcon.className = volume == 0 ? 'fas fa-volume-mute' : volume < 0.5 ? 'fas fa-volume-down' : 'fas fa-volume-up';
    isMuted = volume == 0;
    localStorage.setItem('volume', volume);
}

// Toggle shuffle
function toggleShuffle() {
    isShuffled = !isShuffled;
    document.getElementById('shuffleBtn').classList.toggle('active', isShuffled);
    updateUpNextList();
}

// Toggle loop
function toggleLoop() {
    isLooped = !isLooped;
    audio.loop = isLooped;
    video.loop = isLooped;
    document.getElementById('loopBtn').classList.toggle('active', isLooped);
}

// Seek to position
function seek(event) {
    if (currentTrackIndex < 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const pos = (event.clientX - rect.left) / rect.width;
    const newTime = pos * audio.duration;
    audio.currentTime = newTime;
    if (tracks[currentTrackIndex].videoUrl) video.currentTime = newTime;
}

// Setup draggable progress
function setupProgressDrag() {
    const progressContainer = document.querySelector('.progress-container');
    progressContainer.addEventListener('mousedown', function (e) {
        const handleMouseMove = (e) => seek(e);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', () => document.removeEventListener('mousemove', handleMouseMove), { once: true });
    });
}

// Update progress bar
function updateProgressBar() {
    if (currentTrackIndex < 0 || isNaN(audio.duration)) return;
    const progress = (audio.currentTime / audio.duration) * 100;
    progressBar.style.width = `${progress}%`;
    progressKnob.style.left = `${progress}%`;
    document.getElementById('currentTime').textContent = formatTime(audio.currentTime);
    document.getElementById('duration').textContent = formatTime(audio.duration);
}

// Toggle fullscreen
function toggleFullscreen() {
    if (!isFullscreen) {
        videoContainer.requestFullscreen?.() || videoContainer.mozRequestFullScreen?.() || videoContainer.webkitRequestFullscreen?.() || videoContainer.msRequestFullscreen?.();
        document.querySelector('.fullscreen-btn i').className = 'fas fa-compress';
    } else {
        document.exitFullscreen?.() || document.mozCancelFullScreen?.() || document.webkitExitFullscreen?.() || document.msExitFullscreen?.();
        document.querySelector('.fullscreen-btn i').className = 'fas fa-expand';
    }
    isFullscreen = !isFullscreen;
}

// Toggle between video and audio view
function toggleMediaView() {
    if (!tracks[currentTrackIndex]?.videoUrl) return;
    document.body.classList.toggle('video-player-active');
    isVideoView = document.body.classList.contains('video-player-active');
    document.querySelector('.media-toggle-btn i').className = isVideoView ? 'fas fa-music' : 'fas fa-tv';
    updateUpNextList();
}

// Format time (seconds to mm:ss)
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Play track by index
function playTrackByIndex(index) {
    if (!tracks.length || index < 0 || index >= tracks.length) return;
    currentTrackIndex = index;
    const track = tracks[index];

    audio.src = track.audioUrl;
    if (track.videoUrl) {
        video.src = track.videoUrl;
        videoContainer.style.display = 'block';
        document.body.classList.add('video-player-active');
        isVideoView = true;
    } else {
        video.src = '';
        videoContainer.style.display = 'none';
        document.body.classList.remove('video-player-active');
        isVideoView = false;
    }

    playerTitle.textContent = track.title;
    playerThumb.src = track.cover;
    document.getElementById('player').classList.add('player-active');
    updateNowPlaying(track);
    updateUpNextList();

    audio.play();
    if (track.videoUrl) video.play();
    isPlaying = true;
    updatePlayPauseIcons();
}

// Update now playing information
function updateNowPlaying(track) {
    if (!track) return;
    nowPlayingContainer.innerHTML = `
        <button class="back-to-video-btn" onclick="toggleMediaView()" aria-label="Back to Video">
            <i class="fas fa-tv"></i>
        </button>
        <img src="${track.cover}" alt="${track.title}">
        <div>
            <h3>${track.title}</h3>
            <p>Now Playing</p>
        </div>
    `;
    nowPlayingContainer.classList.add('now-playing-active');
}

// Play next track
function playNextTrack() {
    if (playNextQueue.length > 0) {
        const nextIndex = playNextQueue.shift();
        playTrackByIndex(nextIndex);
    } else if (!tracks.length) {
        return;
    } else {
        let nextIndex = isShuffled ?
            Math.floor(Math.random() * tracks.length) :
            (currentTrackIndex + 1) % tracks.length;
        playTrackByIndex(nextIndex);
    }
}

// Play previous track
function playPrevTrack() {
    if (!tracks.length) return;
    let prevIndex = isShuffled ?
        Math.floor(Math.random() * tracks.length) :
        (currentTrackIndex - 1 + tracks.length) % tracks.length;
    playTrackByIndex(prevIndex);
}

// Keyboard shortcuts
function handleKeyboardShortcuts(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    switch (e.key) {
        case ' ': e.preventDefault(); togglePlay(); break;
        case 'ArrowRight': skip(10); break;
        case 'ArrowLeft': skip(-10); break;
        case 'ArrowUp': e.preventDefault(); setVolume(Math.min(1, audio.volume + 0.1)); break;
        case 'ArrowDown': e.preventDefault(); setVolume(Math.max(0, audio.volume - 0.1)); break;
        case 'f': toggleFullscreen(); break;
        case 'm': toggleMute(); break;
        case 'n': playNextTrack(); break;
        case 'p': playPrevTrack(); break;
        case 'l': toggleLoop(); break;
        case 's': toggleShuffle(); break;
        case 'v': if (tracks[currentTrackIndex]?.videoUrl) toggleMediaView(); break;
    }
}

// Toggle dropdown
function toggleDropdown() {
    const dropdownContent = document.getElementById('dropdownContent');
    dropdownContent.style.display = dropdownContent.style.display === 'block' ? 'none' : 'block';
}

// Select resolution
function selectResolution(resolution) {
    selectedResolution = resolution;
    document.getElementById('selectedResolution').textContent = resolution;
    toggleDropdown();
}

// Download a track from YouTube
function downloadTrack() {
    const url = document.getElementById('urlInput').value.trim();
    if (!url) {
        showAlert('Please enter a valid YouTube URL', 'error');
        return;
    }

    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubeRegex.test(url)) {
        showAlert('Please enter a valid YouTube URL', 'error');
        return;
    }

    const alert = showAlert('Downloading... This may take a minute', 'progress');
    if (eventSource) eventSource.close();

    eventSource = new EventSource(`/download?url=${encodeURIComponent(url)}&resolution=${selectedResolution}`);
    eventSource.onmessage = function (event) {
        const data = JSON.parse(event.data);
        if (data.type === 'progress') {
            alert.querySelector('.progress-bar-inner').style.width = `${data.progress}%`;
            alert.querySelector('span').textContent = data.message;
        } else if (data.type === 'complete') {
            const track = {
                id: data.id,
                title: data.title,
                audioUrl: data.audio,
                videoUrl: data.video,
                cover: data.cover
            };
            tracks.push(track);
            updateTracksList();
            saveTracksToStorage();
            showAlert('Track downloaded successfully!', 'success');
            document.getElementById('urlInput').value = '';
            if (tracks.length === 1) playTrackByIndex(0);
            eventSource.close();
            eventSource = null;
        } else if (data.type === 'error') {
            showAlert(data.message, 'error');
            eventSource.close();
            eventSource = null;
        }
    };

    eventSource.onerror = function () {
        showAlert('Download failed. Please try again.', 'error');
        eventSource.close();
        eventSource = null;
    };
}

// Update tracks list in UI
function updateTracksList() {
    const container = document.getElementById('tracksContainer');
    if (!tracks.length) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-music"></i>
                <h3>No tracks yet</h3>
                <p>Enter a YouTube URL above to download and play your favorite tracks</p>
            </div>
        `;
        upNextContainer.innerHTML = '';
        return;
    }

    container.innerHTML = '';
    tracks.forEach((track, index) => {
        const card = document.createElement('div');
        card.className = 'track-card';
        card.innerHTML = `
            <div class="track-card-image">
                <img src="${track.cover}" alt="${track.title}">
            </div>
            <div class="track-info">
                <div>
                    <h3>${track.title}</h3>
                    <small>${formatTrackNumber(index + 1)}</small>
                </div>
                <div class="hamburger-menu" onclick="toggleTrackMenu(event, ${index})">
                    <div class="bar"></div>
                    <div class="bar"></div>
                    <div class="bar"></div>
                    <div class="dropdown-menu">
                        <div class="dropdown-item" onclick="addToPlaylist(${index})">Add to Playlist</div>
                        <div class="dropdown-item" onclick="playNext(${index})">Play Next</div>
                        <div class="dropdown-item" onclick="renameTrack(${index})">Rename Track</div>
                        <div class="dropdown-item" onclick="removeTrack(${index})">Delete Track</div>
                    </div>
                </div>
            </div>
        `;
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.hamburger-menu')) playTrackByIndex(index);
        });
        container.appendChild(card);
    });
    updateUpNextList();
}

// Toggle track menu
function toggleTrackMenu(event, index) {
    event.stopPropagation();
    const menu = event.currentTarget.querySelector('.dropdown-menu');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

// Add to playlist
function addToPlaylist(index) {
    const track = tracks[index];
    let options = 'Choose a playlist:\n';
    playlists.forEach((p, i) => options += `${i + 1}. ${p.name}\n`);
    options += `${playlists.length + 1}. Create new playlist`;

    const choice = prompt(options);
    if (!choice) return;

    const choiceNum = parseInt(choice);
    if (choiceNum >= 1 && choiceNum <= playlists.length) {
        const playlist = playlists[choiceNum - 1];
        if (!playlist.tracks.includes(track.id)) {
            playlist.tracks.push(track.id);
            localStorage.setItem('playlists', JSON.stringify(playlists));
            showAlert(`Added to ${playlist.name}`, 'success');
        } else {
            showAlert('Track already in playlist', 'error');
        }
    } else if (choiceNum === playlists.length + 1) {
        const playlistName = prompt('Enter new playlist name:');
        if (playlistName) {
            const newPlaylist = { name: playlistName, tracks: [track.id] };
            playlists.push(newPlaylist);
            localStorage.setItem('playlists', JSON.stringify(playlists));
            showAlert(`Created and added to ${playlistName}`, 'success');
        }
    } else {
        showAlert('Invalid choice', 'error');
    }
}

// Play next
function playNext(index) {
    if (index === currentTrackIndex) return;
    playNextQueue.unshift(index);
    showAlert('Track will play next', 'success');
}

// Rename track
function renameTrack(index) {
    const newTitle = prompt('Enter new track title:', tracks[index].title);
    if (newTitle && newTitle !== tracks[index].title) {
        const track = tracks[index];
        fetch('/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: track.id, newTitle })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                track.title = newTitle;
                track.audioUrl = data.audioUrl;
                track.videoUrl = data.videoUrl;
                track.cover = data.cover;
                updateTracksList();
                if (currentTrackIndex === index) {
                    playerTitle.textContent = newTitle;
                    nowPlayingContainer.querySelector('h3').textContent = newTitle;
                }
                showAlert('Track renamed successfully', 'success');
            } else {
                showAlert('Failed to rename track', 'error');
            }
        })
        .catch(error => {
            console.error('Error renaming track:', error);
            showAlert('Failed to rename track', 'error');
        });
    }
}

// Remove track
function removeTrack(index) {
    const track = tracks[index];
    if (confirm(`Are you sure you want to delete "${track.title}"?`)) {
        fetch('/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: track.id })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (index === currentTrackIndex) {
                    pauseMedia();
                    currentTrackIndex = -1;
                    document.getElementById('player').classList.remove('player-active');
                }
                tracks.splice(index, 1);
                updateTracksList();
                saveTracksToStorage();
                showAlert('Track deleted successfully', 'success');
            } else {
                showAlert('Failed to delete track', 'error');
            }
        })
        .catch(error => {
            console.error('Error deleting track:', error);
            showAlert('Failed to delete track', 'error');
        });
    }
}

// Update Up Next list
function updateUpNextList() {
    upNextContainer.innerHTML = '<h2>Up Next</h2>';
    if (currentTrackIndex < 0 || isShuffled || !isVideoView) {
        upNextContainer.style.display = 'none';
        return;
    }

    for (let i = currentTrackIndex + 1; i < tracks.length; i++) {
        const track = tracks[i];
        const card = document.createElement('div');
        card.className = 'upnext-card';
        card.innerHTML = `
            <img src="${track.cover}" alt="${track.title}">
            <div class="track-info">
                <h3>${track.title}</h3>
                <small>${formatTrackNumber(i + 1)}</small>
            </div>
        `;
        upNextContainer.appendChild(card);
    }
}

// Format track number
function formatTrackNumber(num) {
    return `Track ${num < 10 ? '0' : ''}${num}`;
}

// Show alert
function showAlert(message, type) {
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());

    const alert = document.createElement('div');
    alert.className = `alert ${type}`;
    const icon = type === 'error' ? 'fa-exclamation-circle' : type === 'success' ? 'fa-check-circle' : 'fa-spinner';
    alert.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
        ${type === 'progress' ? '<div class="progress-bar-container"><div class="progress-bar-inner"></div></div>' : ''}
    `;
    document.body.appendChild(alert);

    if (type !== 'progress') {
        setTimeout(() => {
            alert.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => alert.remove(), 300);
        }, 4000);
    }
    return alert;
}

// Load tracks from server and local storage
function loadTracks() {
    fetch('/tracks')
        .then(response => response.json())
        .then(serverTracks => {
            const localTracks = JSON.parse(localStorage.getItem('ytune_tracks') || '[]');
            tracks = serverTracks.map(track => ({
                id: track.id,
                title: track.title,
                audioUrl: track.audio,
                videoUrl: track.video,
                cover: track.cover
            }));
            localTracks.forEach(localTrack => {
                if (!tracks.some(t => t.id === localTrack.id)) tracks.push(localTrack);
            });
            updateTracksList();
            saveTracksToStorage();
        })
        .catch(error => {
            console.error('Error loading tracks from server:', error);
            tracks = JSON.parse(localStorage.getItem('ytune_tracks') || '[]');
            updateTracksList();
        });
}

// Save tracks to local storage
function saveTracksToStorage() {
    localStorage.setItem('ytune_tracks', JSON.stringify(tracks));
    localStorage.setItem('playlists', JSON.stringify(playlists));
}

// Show custom confirmation prompt
function showConfirmPrompt(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const yesBtn = document.getElementById('confirmYes');
        const noBtn = document.getElementById('confirmNo');
        const messageEl = modal.querySelector('p');

        messageEl.textContent = message;
        modal.style.display = 'flex';

        const cleanup = () => {
            modal.style.display = 'none';
            yesBtn.removeEventListener('click', handleYes);
            noBtn.removeEventListener('click', handleNo);
        };

        const handleYes = () => {
            cleanup();
            resolve(true);
        };

        const handleNo = () => {
            cleanup();
            resolve(false);
        };

        yesBtn.addEventListener('click', handleYes);
        noBtn.addEventListener('click', handleNo);
    });
}

// Clear all localStorage data with custom prompt
async function clearCache() {
    const confirmed = await showConfirmPrompt('Are you sure you want to clear all cached data? This will reset playlists and locally stored tracks.');
    if (confirmed) {
        localStorage.clear();
        tracks = [];
        currentTrackIndex = -1;
        playNextQueue = [];
        playlists = [];
        pauseMedia();
        document.getElementById('player').classList.remove('player-active');
        nowPlayingContainer.classList.remove('now-playing-active');
        updateTracksList();
        showAlert('Cache cleared successfully', 'success');
    }
}

// Initialize on page load
window.addEventListener('load', () => {
    initPlayer();
    loadTracks();
    window.addEventListener('beforeunload', saveTracksToStorage);
});

document.addEventListener('fullscreenchange', () => {
    isFullscreen = !!document.fullscreenElement;
    document.querySelector('.fullscreen-btn i').className = isFullscreen ? 'fas fa-compress' : 'fas fa-expand';
>>>>>>> db13efa (Your Vives are UP!!!)
});