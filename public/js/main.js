// Starting area, boot up the API and proceed to eat memory

// Variables & constants
const socket = io.connect(window.location.href);
const startingChartCountry = 'UK';
const defaultUserSettings = mainApp.defaultSettings;
const defaultDownloadLocation = mainApp.defaultDownloadDir;
const triesToConnect = mainApp.triesToConnect;
let userSettings = [];

// Ping the server to check on the API each second
let initInterval = setInterval(function () {
  socket.emit("checkInit");
}, 1000);

// Check the connection
let initConnectionFails = 0;
socket.on("checkInit", function (data) {
  // if all is good proceed on the next screen
  if (data.status === true) {
    $('#initializing').addClass('animated fadeOut').on('webkitAnimationEnd', function () {
      $(this).css('display', 'none');
    });
    clearInterval(initInterval);
  }

  // If not ... show a message and a quit button
  if (data.status === false) {
    initConnectionFails++;
    if (initConnectionFails >= triesToConnect){
      $('#init-text').text('Connection to Deezer API failed! Please try again.');
      $('#init-preloader').hide();

      $('#initializing .buttons').css('display','inline');
      clearInterval(initInterval);
    }
  }
});

// Open downloads folder
$('#openDownloadsFolder').on('click', function () {
  shell.showItemInFolder(userSettings.downloadLocation + path.sep + '.');
});

// Do misc stuff on page load
$(document).ready(function () {
  $('.modal').modal();

  $(window).scroll(function () {
    if ($(this).scrollTop() > 100) {
      $('#btn_scrollToTop').fadeIn();
    } else {
      $('#btn_scrollToTop').fadeOut();
    }
  });

  $('#btn_scrollToTop').click(function () {
    $('html, body').animate({scrollTop: 0}, 800);
    return false;
  });
});

// Load top charts list for countries
socket.emit("getChartsCountryList", {selected: startingChartCountry});
socket.emit("getChartsTrackListByCountry", {country: startingChartCountry});

// Load settings
socket.emit("getUserSettings");
socket.on('getUserSettings', function (data) {
  userSettings = data.settings;
  console.log('Settings refreshed');
});

/**
 *  Modal Area START
 */

// Prevent default behavior of closing button
$('.modal-close').click(function (e) {
  e.preventDefault();

});

// Settings Modal START
const $settingsAreaParent = $('#modal_settings');

// Open settings panel
$('#nav_btn_openSettingsModal').click(function () {
  fillSettingsModal(userSettings);
});

// Save settings button
$('#modal_settings_btn_saveSettings').click(function () {
  let settings = {};

  // Save
  settings.userDefined = {
    trackNameTemplate: $('#modal_settings_input_trackNameTemplate').val(),
    playlistTrackNameTemplate: $('#modal_settings_input_playlistTrackNameTemplate').val(),
    createM3UFile: $('#modal_settings_cbox_createM3UFile').is(':checked'),
    createArtistFolder: $('#modal_settings_cbox_createArtistFolder').is(':checked'),
    createAlbumFolder: $('#modal_settings_cbox_createAlbumFolder').is(':checked'),
    downloadLocation: $('#modal_settings_input_downloadTracksLocation').val(),
    artworkSize: $('#modal_settings_select_artworkSize').val()
  };

  // Send updated settings to be saved into config file
  socket.emit('saveSettings', settings);
  socket.emit("getUserSettings");
});

// Reset defaults button
$('#modal_settings_btn_defaultSettings').click(function () {
  defaultUserSettings.downloadLocation = defaultDownloadLocation;
  fillSettingsModal(defaultUserSettings);
});

// Populate settings fields
function fillSettingsModal(settings) {

  $('#modal_settings_input_trackNameTemplate').val(settings.trackNameTemplate);
  $('#modal_settings_input_playlistTrackNameTemplate').val(settings.playlistTrackNameTemplate);
  $('#modal_settings_cbox_createM3UFile').prop('checked', settings.createM3UFile);
  $('#modal_settings_cbox_createArtistFolder').prop('checked', settings.createArtistFolder);
  $('#modal_settings_cbox_createAlbumFolder').prop('checked', settings.createAlbumFolder);
  $('#modal_settings_input_downloadTracksLocation').val(settings.downloadLocation);
  $('#modal_settings_select_artworkSize').val(settings.artworkSize);

  Materialize.updateTextFields()
}


//#############################################MODAL_MSG##############################################\\
function message(title, message) {

  $('#modal_msg_title').html(title);

  $('#modal_msg_message').html(message);

  $('#modal_msg').modal('open');

}

//****************************************************************************************************\\
//************************************************TABS************************************************\\
//****************************************************************************************************\\

//###############################################TAB_URL##############################################\\
$('#tab_url_form_url').submit(function (ev) {

  ev.preventDefault();

  var url = $("#song_url").val();

  //Validate URL
  if (url.indexOf('deezer.com/') < 0) {
    message('Wrong URL', 'The URL seems to be wrong. Please check it and try it again.');

    return false;
  }

  if (url.indexOf('?') > -1) {
    url = url.substring(0, url.indexOf("?"));
  }

  addToQueue(url);

});

//#############################################TAB_SEARCH#############################################\\
$('#tab_search_form_search').submit(function (ev) {

  ev.preventDefault();

  var searchString = $('#tab_search_form_search_input_searchString').val().trim();
  var mode = $('#tab_search_form_search').find('input[name=searchMode]:checked').val();

  if (searchString.length == 0) {
    message('Search can\'t be empty', 'You tried to search for nothing. But if you search nothing, you\'ll find nothing. So don\'t try it again.');

    return;
  }

  $('#tab_search_table_results').find('thead').find('tr').addClass('hide');
  $('#tab_search_table_results_tbody_results').addClass('hide');
  $('#tab_search_table_results_tbody_noResults').addClass('hide');
  $('#tab_search_table_results_tbody_loadingIndicator').removeClass('hide');


  socket.emit("search", {type: mode, text: searchString});

});

socket.on('search', function (data) {

  $('#tab_search_table_results_tbody_loadingIndicator').addClass('hide');

  if (data.items.length == 0) {
    $('#tab_search_table_results_tbody_noResults').removeClass('hide');
    return;
  }

  if (data.type == 'track') {

    showResults_table_track(data.items);

  } else if (data.type == 'album') {

    showResults_table_album(data.items);

  } else if (data.type == 'artist') {

    showResults_table_artist(data.items);

  } else if (data.type == 'playlist') {

    showResults_table_playlist(data.items);

  }

  $('#tab_search_table_results_tbody_results').removeClass('hide');

});

function showResults_table_track(tracks) {

  var tableBody = $('#tab_search_table_results_tbody_results');

  $(tableBody).html('');

  $('#tab_search_table_results_thead_track').removeClass('hide');

  for (var i = 0; i < tracks.length; i++) {

    var currentResultTrack = tracks[i];

    $(tableBody).append(
        '<tr class="animated fadeInUp">' +
        '<td><img src="' + currentResultTrack['album']['cover_small'] + '" class="circle"/></td>' +
        (currentResultTrack.explicit_lyrics ? '<td><i class="material-icons valignicon tiny materialize-red-text tooltipped" data-tooltip="Explicit">error_outline</i> ' : '<td> ') + currentResultTrack['title'] + '</td>' +
        '<td>' + currentResultTrack['artist']['name'] + '</td>' +
        '<td>' + currentResultTrack['album']['title'] + '</td>' +
        '<td>' + convertDuration(currentResultTrack['duration']) + '</td>' +
        '</tr>');

    generateDownloadLink(currentResultTrack['link']).appendTo(tableBody.children('tr:last')).wrap('<td>');

  }
  $('.tooltipped').tooltip({delay: 100});
}

function showResults_table_album(albums) {

  var tableBody = $('#tab_search_table_results_tbody_results');

  $(tableBody).html('');
  $('#tab_search_table_results_thead_album').removeClass('hide');

  for (var i = 0; i < albums.length; i++) {

    var currentResultAlbum = albums[i];

    $(tableBody).append(
        '<tr class="animated fadeInUp">' +
        '<td><img src="' + currentResultAlbum['cover_small'] + '" class="circle" /></td>' +
        (currentResultAlbum.explicit_lyrics ? '<td><i class="material-icons valignicon tiny materialize-red-text tooltipped" data-tooltip="Explicit">error_outline</i> ' : '<td> ') + currentResultAlbum['title'] + '</td>' +
        '<td>' + currentResultAlbum['artist']['name'] + '</td>' +
        '<td>' + currentResultAlbum['nb_tracks'] + '</td>' +
        '</tr>');

    generateShowTracklistSelectiveButton(currentResultAlbum['link']).appendTo(tableBody.children('tr:last')).wrap('<td>');
    generateDownloadLink(currentResultAlbum['link']).appendTo(tableBody.children('tr:last')).wrap('<td>');

  }
  $('.tooltipped').tooltip({delay: 100});
}

function showResults_table_artist(artists) {

  var tableBody = $('#tab_search_table_results_tbody_results');

  $(tableBody).html('');

  $('#tab_search_table_results_thead_artist').removeClass('hide');

  for (var i = 0; i < artists.length; i++) {

    var currentResultArtist = artists[i];

    $(tableBody).append(
        '<tr class="animated fadeInUp">' +
        '<td><img src="' + currentResultArtist['picture_small'] + '" class="circle" /></td>' +
        '<td>' + currentResultArtist['name'] + '</td>' +
        '<td>' + currentResultArtist['nb_album'] + '</td>' +
        '</tr>');

    generateShowTracklistButton(currentResultArtist['link']).appendTo(tableBody.children('tr:last')).wrap('<td>');
    generateDownloadLink(currentResultArtist['link']).appendTo(tableBody.children('tr:last')).wrap('<td>');

  }

}

function showResults_table_playlist(playlists) {

  var tableBody = $('#tab_search_table_results_tbody_results');

  $(tableBody).html('');

  $('#tab_search_table_results_thead_playlist').removeClass('hide');

  for (var i = 0; i < playlists.length; i++) {

    var currentResultPlaylist = playlists[i];

    $(tableBody).append(
        '<tr class="animated fadeInUp">' +
        '<td><img src="' + currentResultPlaylist['picture_small'] + '" class="circle" /></td>' +
        '<td>' + currentResultPlaylist['title'] + '</td>' +
        '<td>' + currentResultPlaylist['nb_tracks'] + '</td>' +
        '</tr>');

    generateShowTracklistSelectiveButton(currentResultPlaylist['link']).appendTo(tableBody.children('tr:last')).wrap('<td>');
    generateDownloadLink(currentResultPlaylist['link']).appendTo(tableBody.children('tr:last')).wrap('<td>');

  }
  $('.tooltipped').tooltip({delay: 100});
}

function generateShowTracklistSelectiveButton(link) {

  var btn_showTrackListSelective = $('<a href="#" class="waves-effect btn-flat"><i class="material-icons">list</i></a>');

  $(btn_showTrackListSelective).click(function (ev){
    ev.preventDefault();

    showTrackListSelective(link);
  });

  return btn_showTrackListSelective;
}

function generateShowTracklistButton(link) {

  var btn_showTrackList = $('<a href="#" class="waves-effect btn-flat"><i class="material-icons">list</i></a>');

  $(btn_showTrackList).click(function (ev) {

    ev.preventDefault();

    showTrackList(link);

  });

  return btn_showTrackList;

}

var trackListSelectiveModalApp = new Vue({
  el: '#modal_trackListSelective',
  data: {
    title: null,
    head: null
  }
});

var trackListModalApp = new Vue({
  el: '#modal_trackList',
  data: {
    title: null,
    head: null
  }
});

function showTrackListSelective(link) {

  $('#modal_trackListSelective_table_trackListSelective_tbody_trackListSelective').addClass('hide');
  $('#modal_trackListSelective_table_trackListSelective_tbody_loadingIndicator').removeClass('hide');

  $('#modal_trackListSelective').modal('open');

  socket.emit('getTrackList', {id: getIDFromLink(link), type: getTypeFromLink(link)});
}

$('#download_track_selection').click(function(e){
  e.preventDefault();
  var urls = [];
  $("input:checkbox.trackCheckbox:checked").each(function(){
    urls.push($(this).val());
  });

  if(urls.length != 0){
    for (var ia = 0; ia < urls.length; ia++) {
      addToQueue(urls[ia]);
    }
  }
  $('#modal_trackListSelective').modal('close');
});

function showTrackList(link) {

  $('#modal_trackList_table_trackList_tbody_trackList').addClass('hide');
  $('#modal_trackList_table_trackList_tbody_loadingIndicator').removeClass('hide');

  $('#modal_trackList').modal('open');

  socket.emit("getTrackList", {id: getIDFromLink(link), type: getTypeFromLink(link)});

}
socket.on("getTrackList", function (data) {
  //data.err      -> undefined/err
  //data.id       -> passed id
  //data.response -> API response

  var trackList = data.response.data, content = '';
  var trackListSelective = data.response.data, content = '';

  if (typeof trackList == 'undefined') {
    alert('Well, there seems to be a problem with this part of the app. Please notify the developer.');
    return;
  }

  // ########################################
  if(data.reqType == 'album' || data.reqType == 'playlist'){
    var tableBody = $('#modal_trackListSelective_table_trackListSelective_tbody_trackListSelective');
  } else {
    var tableBody = $('#modal_trackList_table_trackList_tbody_trackList');
  }

  $(tableBody).html('');

  //############################################

  if (data.reqType == 'artist') {
    trackListModalApp.title = 'Album List';
    trackListModalApp.head = [
      {title: '#'},
      {title: ''},
      {title: 'Album Title'},
      {title: 'Release Date'},
      {title: 'Download Album'}
    ];

    for (var i = 0; i < trackList.length; i++) {

      $(tableBody).append('<tr><td>' + (i + 1) + '</td>' +
          (trackList[i].explicit_lyrics ? '<td><i class="material-icons valignicon tiny materialize-red-text tooltipped" data-tooltip="Explicit">error_outline</i></td>' : '<td></td>') +
          '<td><a href="#" id="album_chip" data-link="' + trackList[i].link + '"><div class="chip"><img src="' + trackList[i].cover_small + '" />' + trackList[i].title + '</div></a></td>' +
          '<td>' + trackList[i].release_date + '</td>');

      generateDownloadLink(trackList[i].link).appendTo(tableBody.children('tr:last')).wrap('<td>');
    }
  } else if(data.reqType == 'album' || data.reqType == 'playlist')  {
    trackListSelectiveModalApp.title = 'Tracklist';

    trackListSelectiveModalApp.head = [
      {title: '#'},
      {title: 'Song'},
      {title: 'Artist'},
      {title: '<i class="material-icons">timer</i>'},
      {title: '<div class="valign-wrapper"><input class="selectAll" type="checkbox" id="selectAll"><label for="selectAll"></label></div>'}
    ];

    $('.selectAll').prop('checked', false);

    for (var i = 0; i < trackList.length; i++) {
      $(tableBody).append('<tr><td>' + (i + 1) + '</td>' +
          (trackList[i].explicit_lyrics ? '<td><i class="material-icons valignicon tiny materialize-red-text tooltipped" data-tooltip="Explicit">error_outline</i> ' : '<td> ') + trackList[i].title + '</td>' +
          '<td>' + trackList[i].artist.name + '</td>' +
          '<td>' + convertDuration(trackList[i].duration) + '</td>' +
          '<td><div class="valign-wrapper"><input class="trackCheckbox valign" type="checkbox" id="trackChk'+ i +'" value="' + trackList[i].link + '"><label for="trackChk' + i + '"></label></div></tr>');
    }
  } else {
    trackListModalApp.title = 'Tracklist';
    trackListModalApp.head = [
      {title: '#'},
      {title: 'Song'},
      {title: 'Artist'},
      {title: '<i class="material-icons">timer</i>'}
    ];

    for (var i = 0; i < trackList.length; i++) {

      $(tableBody).append('<tr><td>' + (i + 1) + '</td>' +
          (trackList[i].explicit_lyrics ? '<td><i class="material-icons valignicon tiny materialize-red-text tooltipped" data-tooltip="Explicit">error_outline</i> ' : '<td> ') +
          trackList[i].title + '</td>' +
          '<td>' + trackList[i].artist.name + '</td>' +
          '<td>' + convertDuration(trackList[i].duration) + '</td></tr>');

    }
  }

  if(data.reqType == 'album' || data.reqType == 'playlist'){
    $('#modal_trackListSelective_table_trackListSelective_tbody_loadingIndicator').addClass('hide');
    $('#modal_trackListSelective_table_trackListSelective_tbody_trackListSelective').removeClass('hide');
  } else {
    $('#modal_trackList_table_trackList_tbody_loadingIndicator').addClass('hide');
    $('#modal_trackList_table_trackList_tbody_trackList').removeClass('hide');
  }

  //$('#modal_trackList_table_trackList_tbody_trackList').html(content);

  $('#album_chip').click(function(e){
    $('#modal_trackList').modal('close');
    showTrackListSelective($(this).data('link'));
  });

});

//#############################################TAB_CHARTS#############################################\\
socket.on("getChartsCountryList", function (data) {
  //data.countries    -> Array
  //data.countries[0].country -> String (country name)
  //data.countries[0].picture_small/picture_medium/picture_big -> url to cover

  for (var i = 0; i < data.countries.length; i++) {
    $('#tab_charts_select_country').append('<option value="' + data.countries[i]['country'] + '" data-icon="' + data.countries[i]['picture_small'] + '" class="left circle">' + data.countries[i]['country'] + '</option>');
  }

  $('#tab_charts_select_country').find('option[value="' + data.selected + '"]').attr("selected", true);

  $('select').material_select();
});

$('#tab_charts_select_country').on('change', function () {

  var country = $(this).find('option:selected').val();

  $('#tab_charts_table_charts_tbody_charts').addClass('hide');
  $('#tab_charts_table_charts_tbody_loadingIndicator').removeClass('hide');

  socket.emit("getChartsTrackListByCountry", {country: country});

});

socket.on("getChartsTrackListByCountry", function (data) {
  //data.playlist    -> Object with Playlist information
  //data.tracks      -> Array
  //data.tracks[0]   -> Object of track 0

  var chartsTableBody = $('#tab_charts_table_charts_tbody_charts'), currentChartTrack;

  chartsTableBody.html('');

  for (var i = 0; i < data.tracks.length; i++) {

    currentChartTrack = data.tracks[i];

    $(chartsTableBody).append(
        '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td><img src="' + currentChartTrack['album']['cover_small'] + '" class="circle" /></td>' +
        '<td>' + currentChartTrack['title'] + '</td>' +
        '<td>' + currentChartTrack['artist']['name'] + '</td>' +
        '<td>' + currentChartTrack['album']['title'] + '</td>' +
        '<td>' + convertDuration(currentChartTrack['duration']) + '</td>' +
        '</tr>');

    generateDownloadLink(currentChartTrack['link']).appendTo(chartsTableBody.children('tr:last')).wrap('<td>');

  }

  $('#tab_charts_table_charts_tbody_loadingIndicator').addClass('hide');
  chartsTableBody.removeClass('hide');

});

//############################################TAB_DOWNLOADS###########################################\\
function addToQueue(url) {

  var type = getTypeFromLink(url), id = getIDFromLink(url);

  if (type == 'track') {
    userSettings.filename = userSettings.trackNameTemplate;
  } else if (type == 'playlist') {
    userSettings.filename = userSettings.playlistTrackNameTemplate;
  } else if (type == 'album') {
    userSettings.filename = userSettings.playlistTrackNameTemplate;
  } else if (type == 'artist') {
    userSettings.filename = userSettings.playlistTrackNameTemplate;
  } else {
    $('#modal_wrongURL').modal('open');
    return false;
  }

  if (alreadyInQueue(id)) {
    Materialize.toast('<i class="material-icons">playlist_add_check</i>Already in download-queue!', 5000, 'rounded');

    return false;
  }

  if (id.match(/^[0-9]+$/) == null) {
    $('#modal_wrongURL').modal('open');

    return false;
  }

  socket.emit("download" + type, {id: id, settings: userSettings});

  Materialize.toast('<i class="material-icons">add</i>Added to download-queue', 5000, 'rounded');

}

function alreadyInQueue(id) {

  var alreadyInQueue = false;

  $('#tab_downloads_table_downloads').find('tbody').find('tr').each(function () {

    if ($(this).data('deezerid') == id) {
      alreadyInQueue = true;

      return false
    }

  });

  return alreadyInQueue;

}

socket.on('addToQueue', function (data) {

  var tableBody = $('#tab_downloads_table_downloads').find('tbody');

  $(tableBody).append(
      '<tr id="' + data.queueId + '" data-deezerid="' + data.id + '">' +
      '<td class="queueTitle">' + data.name + '</td>' +
      '<td class="queueSize">' + data.size + '</td>' +
      '<td class="queueDownloaded">' + data.downloaded + '</td>' +
      '<td class="queueFailed">' + data.failed + '</td>' +
      '<td><div class="progress"><div class="indeterminate"></div></div></td>' +
      '</tr>');

  var btn_remove = $('<a href="#" class="btn-flat waves-effect"><i class="material-icons">remove</i></a>');

  $(btn_remove).click(function (ev) {

    ev.preventDefault();

    socket.emit("cancelDownload", {queueId: data.queueId});

  });

  btn_remove.appendTo(tableBody.children('tr:last')).wrap('<td class="eventBtn center">');

});

socket.on("downloadStarted", function (data) {
  //data.queueId -> queueId of started download

  //Switch progress type indeterminate to determinate
  $('#' + data.queueId).find('.indeterminate').removeClass('indeterminate').addClass('determinate');
  $('#' + data.queueId).find('.eventBtn').find('a').html('<i class="material-icons">clear</i>');

});

socket.on('updateQueue', function (data) {

  if (data.cancelFlag) {
    return;
  }

  $('#' + data.queueId).find('.queueDownloaded').html(data.downloaded);
  $('#' + data.queueId).find('.queueFailed').html(data.failed);

  if (data.failed == 0 && ((data.downloaded + data.failed) >= data.size)) {
    $('#' + data.queueId).find('.eventBtn').html('<i class="material-icons">done</i>');
    $('#' + data.queueId).addClass('finished');
    Materialize.toast('<i class="material-icons">done</i>One download completed!', 5000, 'rounded')
  } else if (data.downloaded == 0 && ((data.downloaded + data.failed) >= data.size)) {
    $('#' + data.queueId).find('.eventBtn').html('<i class="material-icons">error</i>');
    $('#' + data.queueId).addClass('error');
    Materialize.toast('<i class="material-icons">error</i>One download failed!', 5000, 'rounded')
  }

});

socket.on("downloadProgress", function (data) {
  //data.queueId -> id (string)
  //data.percentage -> float/double, percentage
  //updated in 1% steps

  $('#' + data.queueId).find('.determinate').css('width', data.percentage + '%');

});

socket.on("emptyDownloadQueue", function () {

  Materialize.toast('<i class="material-icons">done_all</i>All downloads completed!', 5000, 'rounded');

});

socket.on("cancelDownload", function (data) {
  //data.queueId    -> queueId of item which was canceled
  $('#' + data.queueId).addClass('animated fadeOutRight').on('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function () {
    $(this).remove();
    Materialize.toast('<i class="material-icons">clear</i>One download removed!', 5000, 'rounded')
  });
});

$('#clearTracksTable').click(function (ev) {

  $('#tab_downloads_table_downloads').find('tbody').find('.finished', '.error').addClass('animated fadeOutRight').on('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function () {
    $(this).remove();
  });

  return false;

});

//****************************************************************************************************\\
//******************************************HELPER-FUNCTIONS******************************************\\
//****************************************************************************************************\\
function getIDFromLink(link) {

  return link.substring(link.lastIndexOf("/") + 1);

}

function getTypeFromLink(link) {

  var type;

  if (link.indexOf('track') > -1) {
    type = "track";
  } else if (link.indexOf('playlist') > -1) {
    type = "playlist";
  } else if (link.indexOf('album') > -1) {
    type = "album";
  } else if (link.indexOf('artist')) {
    type = "artist";
  }

  return type;

}

function generateDownloadLink(url) {

  var btn_download = $('<a href="#" class="waves-effect btn-flat"><i class="material-icons">file_download</i></a>');

  $(btn_download).click(function (ev) {

    ev.preventDefault();

    addToQueue(url);

  });

  return btn_download;

}

function convertDuration(duration) {

  //convert from seconds only to mm:ss format
  var mm, ss;
  mm = Math.floor(duration / 60);
  ss = duration - (mm * 60);

  //add leading zero if ss < 0
  if (ss < 10) {
    ss = "0" + ss;
  }

  return mm + ":" + ss;

}
