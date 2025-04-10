$(document).ready(function() {
    let myChartAll, myChartLyric, myChartVocal, myChartInst;
    let all_scatterData, lyric_scatterData, vocal_scatterData, inst_scatterData;
    let current_scatterData = null;
    let lastClickedSongID = "sm15630734"; // マップ上で選択されている楽曲（初期はsm15630734）
    let listenSongID = "sm15630734"; // 再生中の楽曲
    const initialsongID = "sm15630734"
    $.getJSON('song_info/300song_data.json', function(songData) {
        all_scatterData = createScatterData(songData, "all");
        lyric_scatterData = createScatterData(songData, "lyrics");
        vocal_scatterData = createScatterData(songData, "vocal");
        inst_scatterData = createScatterData(songData, "inst");
        
        // 推薦楽曲リストの初期レイヤー
        current_scatterData = all_scatterData;

        myChartAll = renderScatterPlot("all-scatter", Object.values(all_scatterData));
        myChartLyric = renderScatterPlot("lyric-scatter", Object.values(lyric_scatterData));
        myChartVocal = renderScatterPlot("vocal-scatter", Object.values(vocal_scatterData));
        myChartInst = renderScatterPlot("inst-scatter", Object.values(inst_scatterData));
        
        changeMap();
        renderPlaylist(findNearestSongs("sm15630734", current_scatterData), current_scatterData);
        setupClickEventForPlaylist(); // クリックイベントの設定
        $(`.rec-select-window[data-songid="${initialsongID}"]`).trigger('click'); // 初期状態でクリック状態にする
    });

    // select の変更イベント
    $('#mapSelect').on('change', function() {
        changeMap();
    });

    function changeMap() {
        let selectedValue = $('#mapSelect').val();
        $('.map').hide();
        // 選択したマップのcanvasを表示
        $('#' + selectedValue + '-map').show();
    }

    // 全てのスライダーを取得し、イベントリスナーを設定
    document.querySelectorAll('input[type="range"]').forEach(slider => {
        slider.addEventListener('input', function() {
            document.getElementById('value' + this.id.slice(-1)).textContent = this.value;
        });
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
                    // zoom: {
                    //     zoom: {
                    //         wheel: { enabled: true } // マウスホイールでズーム
                    //     }
                    // }
                },
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        const chart = elements[0].element.$context.chart;
                        const dataIndex = elements[0].index;
                        const clickedSong = chart.data.datasets[0].data[dataIndex];
                        const clickedSongId = clickedSong.songid;
                        lastClickedSongID = clickedSongId;
            
                        // プレイリストの更新
                        renderPlaylist(findNearestSongs(clickedSongId, current_scatterData), current_scatterData);
                        setupClickEventForPlaylist(); // プレイリスト再描画後のイベント再設定
                        
                        // プレイリスト上の対象楽曲を選択した状態にする
                        $(`.rec-select-window[data-songid="${clickedSongId}"]`).trigger('click');
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
            .slice(0, 20)
            .map(song => song.songID);
    }

    // プレイリストを描画する関数
    function renderPlaylist(playlist, Data) {
        const $playlist = $('#rec-content').html('<ul></ul>').find('ul');
        playlist.forEach(songId => {
            const song = Data[songId];
            // const isListen = (songId === listenSongID); // クリックされた楽曲どうか判定
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
            const songId = $(this).data('songid'); // 選択された曲のID
            listenSongID = songId; // クリックされた曲のIDを保存
            // songle 読み込み
            $('#player').html(`
                <div data-api="songle-widget-extra-module" data-url="${url}" id="songle-widget" data-songle-widget-ctrl="0" data-api-chorus-auto-reload="1" data-song-start-at="chorus"
                data-video-player-size-w="auto" data-video-player-size-h="300" data-songle-widget-size-w="auto" data-songle-widget-size-h="100"></div>
            `);
            $.getScript("https://widget.songle.jp/v1/widgets.js"); // songle プレイヤーの表示

            $('.rec-select-window .rec-title').removeClass('song-selected'); 
            $(this).find('.rec-title').addClass('song-selected'); // 選択された楽曲のタイトルを緑色に変化
            
            updateScatterPlotColors(songId); // 散布図の色を更新
            song_select_check = true;
            selected_song = $(this); // 現在選択された楽曲を記録
        });
    }

    // レイヤーごとの推薦曲の選択処理
    $('.layer-button').on('click', function () {
        $('.layer-button').removeClass('select-layer');
        $(this).addClass('select-layer');

        // クリックされたボタンのidを取得
        const layerId = $(this).attr('id');

        // クリックされたレイヤーを選択
        switch (layerId) {
            case 'ALL-layer':
                current_scatterData = all_scatterData;
                break;
            case 'LYRIC-layer':
                current_scatterData = lyric_scatterData;
                break;
            case 'VOCAL-layer':
                current_scatterData = vocal_scatterData;
                break;
            case 'INST-layer':
                current_scatterData = inst_scatterData;
                break;
            default:
                current_scatterData = all_scatterData;
        }

        // クリックされたレイヤーの推薦楽曲を更新
        renderPlaylist(findNearestSongs(lastClickedSongID, current_scatterData), current_scatterData);

        // 選択された楽曲があれば、そのタイトルをハイライト
        if (listenSongID) {
            $('#rec-content .rec-select-window').each(function() {
                const songId = $(this).data('songid');
                if (songId === listenSongID) {
                    $(this).find('.rec-title').addClass('song-selected');
                }
            });
        }

        setupClickEventForPlaylist();
    });

    // 散布図の点の色と大きさを更新する関数
    function updateScatterPlotColors(selectedSongId) {
        [myChartAll, myChartLyric, myChartVocal, myChartInst].forEach(chart => {
            if (!chart) return;
            chart.data.datasets[0].backgroundColor = chart.data.datasets[0].data.map(song =>
                song.songid === selectedSongId ? 'rgba(73,211,85)' : 'rgba(0, 0, 0, 0.75)'
            )
            chart.data.datasets[0].pointRadius = chart.data.datasets[0].data.map(song =>
                song.songid === selectedSongId ? 6.5 : 3.5
            );

            chart.update(); // グラフを更新
        });
    }

    // 各評価ボタンをクリックした時に実行する
    $('.rating-button').on('click', function () {
        // 現在の評価ボタンのアイコンをクリックしたボタンに変更
        var icon = $(this).find("i");

        // 同じ評価タイプ内のすべてのボタンをリセット
        $(this).closest('.evaluation-type').find('.rating-button i').removeClass('active');

        // クリックされたアイコンに"active"クラスを追加して色を変更
        icon.addClass('active');
    });
});