// ==UserScript==
// @name        부동산 매물 가격 필터 for 월부
// @namespace   Violentmonkey Scripts
// @match       https://new.land.naver.com/complexes*
// @version     1.02
// @author      치즈0
// @description Please use with violentmonkey
// @downloadURL https://raw.githubusercontent.com/cheesechoi/aptMiner/main/land.priceParser.plugin.user.js
// @updateURL   https://raw.githubusercontent.com/cheesechoi/aptMiner/main/land.priceParser.plugin.user.js
// ==/UserScript==

function waitUntilAptListLoaded() {
    var loadingClass = document.querySelector("#complexOverviewList > div > div.item_area > div");
    if (!loadingClass || loadingClass.className == "loading") {
        window.setTimeout(waitUntilAptListLoaded, 1000);
    }
    return;
}

function checkMandantoryCondition(size) {
    // 84 미만
    if (/\d+/g.exec(size) > 120) {
        //console.log('Filtered by size - ', size);
        return false;
    }
    // todo : 300세대 미만, 용적률, 기타등등
    return true;
}

function getFloor(strFloor) {
    return strFloor.replace("층", "").split('/');
}

function checkItemCondition(tradeType, floor, spec) {

    //매매, 전세
    if (tradeType != "전세" && tradeType != "매매") {
        //console.log('Filtered by trade type - ', tradeType);
        return false;
    }

    /* // 하락장 진입으로 인해 세안은 물건이 더 메리트있는 경우가 생김. 상승장 시 재적용.
    // 세안고 제외
    if (spec.includes("끼고") || spec.includes("안고") || spec.includes("승계")) {
        //console.log('Filtered by spec - ', spec);
        return false;
    } else {
        //console.log('Allowed spec - ', spec);
    }
    */

    // 층 - 전세의 경우 층에 관계없이 최고가 적용
    if (tradeType == "매매") {
        // 층 명확하지 않은 것 제외
        var _floorInfo = getFloor(floor);
        if (_floorInfo[0] == "저") {
            //console.log('Filtered by floor - ', _floorInfo);
            return false;
        }
        // 1층, 2층, 탑층 제외
        if (_floorInfo[0] == "1" || _floorInfo[0] == "2" || _floorInfo[0] == _floorInfo[1]) {
            //console.log('Filtered by floor - ', _floorInfo);
            return false;
        }

        // 5층 이상 건물에서 3층 이하 제외
        if (_floorInfo[1] >= 5 && _floorInfo[0] <= 3) {
            //console.log('Filtered by floor - ', _floorInfo);
            return false;
        }
    }
    return true;
}

function parsePrice(tradePrice) {
    tradePrice = tradePrice.replace(" ", "").replace(",", "");
    if (tradePrice.includes("억"))
        return parseInt(tradePrice.split("억")[0] * 10000) + (parseInt(tradePrice.split("억")[1]) || 0);
    else
        return parseInt(tradePrice)
}

function getPrice_WeolbuStandard() {

    var dictPricePerSize = {};

    document.querySelectorAll("#articleListArea > div").forEach(function(ele) {
        //console.log(ele);
        var size = ele.querySelectorAll("div.info_area .line .spec")[0].innerText.split(", ")[0]; // 103/84m^2
        var tradeType = ele.querySelector("div.price_line .type").innerText; // 매매, 전세
        var floor = ele.querySelectorAll("div.info_area .line .spec")[0].innerText.split(", ")[1]; // 3/10층
        var tradePrice = parsePrice(ele.querySelector("div.price_line .price").innerText); // 141000
        var spec = ele.querySelectorAll("div.info_area .line .spec")[1]; // 확장올수리, 정상입주, 수내중학군
        spec = spec ? spec.innerText : "";


        if (!checkMandantoryCondition(size)) {
            return;
        }
        if (!(size in dictPricePerSize))
            dictPricePerSize[size] = { '매매': null, '전세': null, '갭': null, '전세가율': null, '매매층': null, '전세층': null };

        if (!checkItemCondition(tradeType, floor, spec)) {
            return;
        }

        if ((dictPricePerSize[size][tradeType] == null) ||
            (tradeType == "매매" && dictPricePerSize[size][tradeType] > tradePrice) ||
            (tradeType == "전세" && dictPricePerSize[size][tradeType] > tradePrice)) {
            // 하락장을 맞아 전세가 최저가로 적용
            //(tradeType == "전세" && dictPricePerSize[size][tradeType] < tradePrice)) {
            dictPricePerSize[size][tradeType] = tradePrice;
            dictPricePerSize[size][tradeType + "층"] = getFloor(floor)[0];
        }

        if (dictPricePerSize[size]['매매'] & dictPricePerSize[size]['전세']) {
            dictPricePerSize[size]['갭'] = dictPricePerSize[size]['매매'] - dictPricePerSize[size]['전세'];
            dictPricePerSize[size]['전세가율'] = parseInt((dictPricePerSize[size]['전세'] / dictPricePerSize[size]['매매']) * 100) + "%";
        }
    });

    return dictPricePerSize;
}

function addInfoToScreen(infos) {

    var oldScreenInfo = document.querySelector("#summaryInfo > div.complex_summary_info > div.complex_price_info");
    if (oldScreenInfo)
        oldScreenInfo.remove();

    var screenInfo = document.createElement('div');
    screenInfo.setAttribute('class', 'complex_price_info');
    screenInfo.style.marginTop = "10px";

    for (let size in infos) {

        var strTradePriceInfo = (infos[size]['매매'] ? infos[size]['매매'] + "/" + infos[size]['매매층'] : "0/-");
        var strLeasePriceInfo = (infos[size]['전세'] ? infos[size]['전세'] + "/" + infos[size]['전세층'] : "0/-");

        var additionalInfos = [];
        if (infos[size]['매매'] && infos[size]['전세']) {
            additionalInfos.push(infos[size]['갭']);
            additionalInfos.push(infos[size]['전세가율']);
        }

        if (infos[size]['매매']) {
            var py = parseInt(/\d+/g.exec(size), 10) / 3.3;
            additionalInfos.push(parseInt(infos[size]['매매'] / py) + "/3.3m²");
        }

        var strAdditionalInfo = "";
        if (additionalInfos.length > 0)
            strAdditionalInfo += "  (" + additionalInfos.join(", ") + ")";

        var cloned = document.querySelector("#summaryInfo > div.complex_summary_info > div.complex_trade_wrap > div > dl:nth-child(1)").cloneNode(true);
        cloned.setAttribute("added", true);
        cloned.getElementsByClassName("title")[0].innerText = size;

        var trade = cloned.getElementsByClassName("data")[0];
        var lease = trade.cloneNode(true);
        var additionalInfo = trade.cloneNode(true);
        var delim = trade.cloneNode(true);

        // remove, then reordering (please make it more fancy)        
        trade.innerText = strTradePriceInfo;
        trade.style.color = '#f34c59';
        lease.innerText = strLeasePriceInfo;
        lease.style.color = '#4c94e8';
        delim.innerText = " / ";
        delim.style.color = '#ffffff';
        additionalInfo.innerText = strAdditionalInfo;

        // remove, then reordering (please make it fancy..)        
        cloned.removeChild(trade);

        cloned.appendChild(delim);
        cloned.appendChild(trade);
        cloned.appendChild(delim.cloneNode(true));
        cloned.appendChild(lease);
        cloned.appendChild(delim.cloneNode(true));
        cloned.appendChild(additionalInfo);

        screenInfo.appendChild(cloned);
    }

    document.querySelector("#summaryInfo > div.complex_summary_info").insertBefore(screenInfo, document.querySelector("#summaryInfo > div.complex_summary_info > div.complex_detail_link"))
}

function sortOnKeys(dict) {

    var sorted = [];
    for (var key in dict) {
        sorted[sorted.length] = key;
    }

    sorted.sort(function(a, b) {
        return (parseInt(/\d+/g.exec(a), 10) - parseInt(/\d+/g.exec(b), 10));
    });

    var tempDict = {};
    for (var i = 0; i < sorted.length; i++) {
        tempDict[sorted[i]] = dict[sorted[i]];
    }

    return tempDict;
}


var g_lastSelectedApt = "";

function addObserverIfDesiredNodeAvailable() {
    var target = document.getElementsByClassName('map_wrap')[0];

    if (!target)
        return;

    var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            [].slice.call(mutation.addedNodes).forEach(function(addedNode) {
                //console.log('???');
                //console.log(addedNode.classList);
                if (!addedNode.classList ||
                    (!addedNode.classList.contains('infinite_scroll') && !addedNode.classList.contains('item'))) {
                    return;
                }

                if (!document.querySelector("#complexTitle")) {
                    console.log("Unexpected issues #1");
                    return;
                }

                if (document.querySelector("#complexTitle").innerText != g_lastSelectedApt) {
                    document.querySelectorAll("#summaryInfo > div.complex_summary_info > div.complex_trade_wrap > div > dl").forEach(function(ele) {
                        if (ele.hasAttribute("added"))
                            ele.remove();
                    });
                    g_lastSelectedApt = document.querySelector("#complexTitle").innerText;
                }

                result = getPrice_WeolbuStandard();
                result = sortOnKeys(result);
                addInfoToScreen(result);

                //console.log('result ', result);
                document.querySelector("#complexOverviewList > div > div.item_area > div").scrollTop =
                    document.querySelector("#complexOverviewList > div > div.item_area > div").scrollHeight;

                //document.querySelector("#complexOverviewList > div > div.item_area > div").scrollTop = 0;
            });
        });
    });

    var config = {
        childList: true,
        subtree: true,
    };

    observer.observe(target, config);

}

addObserverIfDesiredNodeAvailable();
