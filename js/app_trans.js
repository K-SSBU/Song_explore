$(document).ready(function() {
    let myChartAll, myChartLyric, myChartVocal, myChartInst;
    $.getJSON('song_info/150_songs_data.json', function(songData) {
        const all_scatterData = createScatterData(songData, "all");
        const lyric_scatterData = createScatterData(songData, "lyrics")
        const vocal_scatterData = createScatterData(songData, "vocal")
        const inst_scatterData = createScatterData(songData, "inst")
        // console.log(lyric_scatterData)

        myChartAll = renderScatterPlot("all-scatter", Object.values(all_scatterData));
        myChartLyric = renderScatterPlot("lyric-scatter", Object.values(lyric_scatterData));
        myChartVocal = renderScatterPlot("vocal-scatter", Object.values(vocal_scatterData));
        myChartInst = renderScatterPlot("inst-scatter", Object.values(inst_scatterData));
        // console.log(findNearestSongs("sm15630734", all_scatterData))

        // // プレイリストを描画
        renderPlaylist(findNearestSongs("sm30746418", inst_scatterData), inst_scatterData);
        // renderPlaylist(findNearestSongs("sm30746418", all_scatterData), all_scatterData);
        // renderPlaylist(findNearestSongs("sm30746418", lyric_scatterData), lyric_scatterData);
        // renderPlaylist(findNearestSongs("sm30746418", vocal_scatterData), vocal_scatterData);
        // // クリックイベントの設定
        setupClickEventForPlaylist();
    });

    // 散布データ作成関数
    function createScatterData(songData, category) {
        return Object.fromEntries(
            Object.entries(songData).map(([key, song]) => [
                key, // songID をキーとして利用
                {
                    songid: key,
                    x: song.position[category][0],
                    y: song.position[category][1],
                    title: song.title,
                    writer: song.writer,
                    url: song.url,
                    // thumbnails: song.thumbnails,
                },
            ])
        );
    }

// 散布図を描画する関数
function renderScatterPlot(canvasId, scatterData) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    const chart = new Chart(ctx, {
        type: 'scatter',
        data: { 
            datasets: [
                { 
                    label: '曲', 
                    data: scatterData, 
                    backgroundColor: scatterData.map(() => 'rgba(0,0,0,0.75)'), 
                    pointRadius: scatterData.map(() => 3.5),
                }] 
        },
        options: {
            maintainAspectRatio: false,
            layout: { padding: 20 },
            animation: { duration: 0 },
            scales: { 
                x: { display: false }, 
                y: { display: false } 
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { 
                        label: (tooltipItem) => {
                            const dataPoint = scatterData[tooltipItem.dataIndex];
                            return [`${dataPoint.title}`, `${dataPoint.writer}`];
                        }
                    },
                    mode: 'nearest',
                    intersect: true,
                    bodyFont: { size: 18, weight: 'bold' }
                },
                zoom: {
                    zoom: {
                        wheel: { enabled: true } // マウスホイールでズーム
                    }
                }
            }
        }
    });
    return chart;
}

    // 推薦楽曲を見つける・各song_ID（プレイリスト）を返す関数
    function findNearestSongs(clickedSongID, scatterData) {
        const clickedSong = scatterData[clickedSongID];
        if (!clickedSong) return [];

        return Object.entries(scatterData)
            .map(([songID,song]) => ({
                songID,
                distance: Math.sqrt((song.x - clickedSong.x) ** 2 + (song.y - clickedSong.y) ** 2)
            }))
            .sort((a, b) => a.distance - b.distance)
            // .slice(0, 15)
            .map(song => song.songID);
    }

    // プレイリストを描画する関数
    function renderPlaylist(playlist, Data) {
        const $playlist = $('#rec-content').html('<ul></ul>').find('ul');
        playlist.forEach(songId => {
            const song = Data[songId];
            //console.log(song);
            // const icon_Id = songId.match(/\d+/)[0];
            // <div class="rec-icon" style="background-image: url(${song.thumbnails});"></div>
            $playlist.append(`
                <li class="rec-select-window" data-songid="${songId}" data-url="${song.url}" >
                    <div class="rec-title">${song.title}
                        <div class="rec-writer">${song.writer}</div>
                    </div>
                    <div class="check-button"></div>
                </li>
            `);
        });
    }

    // クリックイベントの設定関数
    function setupClickEventForPlaylist() {
        var song_select_check = false; // 初期状態：プレイリストをクリックしていない
        var selected_song = null; // クリックされた楽曲（初期状態は無し）

        // 楽曲選択時の処理
        $('.rec-select-window').on('click', function() {
            const url = $(this).data('url');
            // songle 読み込み
            $('#player').html(`
                <div data-api="songle-widget-extra-module" data-url="${url}" id="songle-widget" data-songle-widget-ctrl="0" data-api-chorus-auto-reload="1" data-song-start-at="chorus"
                data-video-player-size-w="auto" data-video-player-size-h="500" data-songle-widget-size-w="auto" data-songle-widget-size-h="100"></div>
            `);
            $('.rec-select-window .rec-title').removeClass('song-selected'); 
            $.getScript("https://widget.songle.jp/v1/widgets.js"); // songle プレイヤーの表示
            $(this).find('.rec-title').addClass('song-selected'); // 選択された楽曲のタイトルを緑色に変化
            const songId = $(this).data('songid'); // 選択された曲のID
            updateScatterPlotColors(songId); // 散布図の色を更新
            song_select_check = true;
            selected_song = $(this); // 現在選択された楽曲を記録
        });
    }

    // 散布図の点の色を更新する関数
    function updateScatterPlotColors(selectedSongId) {
        [myChartAll, myChartLyric, myChartVocal, myChartInst].forEach(chart => {
            if (!chart) return;
            chart.data.datasets[0].backgroundColor = chart.data.datasets[0].data.map(song =>
                song.songid === selectedSongId ? 'rgba(73,211,85,0.88)' : 'rgba(0, 0, 0, 0.75)'
            );

            chart.update(); // グラフを更新
        });
    }
});