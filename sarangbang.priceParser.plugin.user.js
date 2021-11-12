// ==UserScript==
// @name        부동산 매물 가격 필터 for 월부 - 사랑방
// @namespace   Violentmonkey Scripts
// @match       https://home.sarangbang.com/v2/maps*
// @version     1.002
// @author      치즈0
// @description Please use with violentmonkey
// @downloadURL https://raw.githubusercontent.com/cheesechoi/aptMiner/main/sarangbang.priceParser.plugin.user.js
// @updateURL   https://raw.githubusercontent.com/cheesechoi/aptMiner/main/sarangbang.priceParser.plugin.user.js
// ==/UserScript==


function waitUntilAptListLoaded() {
    var loadingClass = document.querySelector("#complexOverviewList > div > div.item_area > div");
    if (!loadingClass || loadingClass.className == "loading") {
        window.setTimeout(waitUntilAptListLoaded, 1000);
    }
    return;
}

function hash(s){
  return s.split("").reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0);              
}

function parsePrice(tradePrice) {
    tradePrice = tradePrice.replace(" ", "").replace(",", "");
    if (tradePrice.includes("억"))
        return parseInt(tradePrice.split("억")[0] * 10000) + (parseInt(tradePrice.split("억")[1]) || 0);
    else
        return parseInt(tradePrice)
}

function gatheringPriceInfo() {

    collection = {};
    collection['areaInfo'] = {};
  
    document.querySelectorAll("#listWrap > li").forEach(function(ele) {
   
      tradeType = ele.querySelector("div > div > a > div.lst-price.text-primary > span > span:nth-child(1)").textContent;
      price = parsePrice(ele.querySelector("div > div > a > div.lst-price.text-primary > span > span.mr-1 > span > em").textContent);
      area = ele.querySelector("div > div > a > div.d-flex.flex-wrap > span.mr-2.text-2.lst-area > span.mr-1.area-open > em").textContent;
      areaPrivate = ele.querySelector("div > div > a > div.d-flex.flex-wrap > span.mr-2.text-2.lst-area > span.text-color-grey.area-private > em").textContent;
      numBuilding = ele.querySelector("div > div > a > div.d-flex.flex-wrap > span.dongnum.text-2").textContent;
      floor = ele.querySelector("div > div > a > div.d-flex.flex-wrap > span.floor.text-2").textContent;

      //console.log(tradeType, area, areaPrivate, numBuilding, floor, price);
      aptHash = hash("".concat(tradeType, area, areaPrivate, numBuilding, floor, price))
      

      if (collection[aptHash] === undefined) {

        collection[aptHash] = { 'tradeType' : tradeType, 'price' : price, 'area' : area, 'areaPrivate' : areaPrivate, 'numBuilding' : numBuilding, 'floor' : floor, 'count': 1 };
        if (collection['areaInfo'][area] === undefined) {
          collection['areaInfo'][area] = { '매매': 0, '전세': 0 };
        }
        collection['areaInfo'][area][tradeType] += 1;

      }
      else {

          collection[aptHash]['count'] += 1;

      }
    });
    return collection;
}

function addInfoToScreen(infos) {

    var oldScreenInfo = document.querySelector("#contInfo > div > div.detail-head > div.detail-head-inner > div.complex_price_info");
    if (oldScreenInfo) {
        //console.log('removed');
        oldScreenInfo.remove();
    }
 
    var screenInfo = document.createElement('div');
    screenInfo.setAttribute('class', 'complex_price_info');
    screenInfo.style.marginTop = "10px";

    
  
    for (let size in infos['areaInfo']) {
        //console.log(size);

        var priceInfo = "";
        priceInfo += size + " 매매 " + infos['areaInfo'][size]['매매'] + ", 전세 " + infos['areaInfo'][size]['전세'] + ", ";
      
            
        var lowPrice = undefined;
        var highLease = undefined;

        
        for (const [key, item] of Object.entries(infos)) {

            if (item['area'] === undefined)
                continue;

            if (!item['area'].startsWith(size))
                continue;
            
            if (item['tradeType'] == "매매") {
                if (lowPrice == undefined) {
                    lowPrice = item;
                } else {
                    if (lowPrice['floor'])
                    if ((item['floor'] != "1층" && item['floor'] != "2층" && item['floor'] != "3층" )
                        && (lowPrice['floor'] == "1층" || lowPrice['floor'] == "2층" || lowPrice['floor'] == "3층" ))
                        lowPrice = item;
                    if (item['price'] < lowPrice['price'])
                        lowPrice = item;
                }
            }
            else if (item['tradeType'] == "전세") {
                if (highLease == undefined) {
                    highLease = item;
                } else {
                    if (highLease['price'] < item['price'])
                        highLease = item;
                }
            }
        };
  
  
     
        priceInfo += (lowPrice !== undefined) ? (lowPrice['price']/10000).toFixed(2) + "억 (" + lowPrice['floor'] + ") / " : "0" + " / ";
        priceInfo += (highLease !== undefined) ? (highLease['price']/10000).toFixed(2) + "억 (" + highLease['floor'] + ") " : "0 ";

        var additionalInfos = [];
        if (lowPrice !== undefined  && highLease !== undefined ) {
            priceInfo += ", "+((lowPrice['price'] - highLease['price'])/10000).toFixed(2) + "억, "; // 갭
            priceInfo += Math.floor(highLease['price'] / lowPrice['price'] * 100)+"%"; // 전세가율
        }

        var cloned = document.querySelector("#contInfo > div > div.detail-head > div.detail-head-inner > h2").cloneNode(true);
        cloned.setAttribute("added", true);
        cloned.innerText = priceInfo;
        screenInfo.appendChild(cloned);
    }

    document.querySelector("#contInfo > div > div.detail-head > div.detail-head-inner").insertBefore(screenInfo, document.querySelector("#contInfo > div > div.detail-head > div.detail-head-inner > h2").nextSibling)
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
    //console.log("?");
    var target = document.getElementsByClassName('content-wrap')[0];
    //console.log(target);
    if (!target)
        return;

    var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            [].slice.call(mutation.addedNodes).forEach(function(addedNode) {


                if (!addedNode.classList ||
                    !addedNode.classList.contains('col-12')) { //} ||
                    return;
                }              
                
                collection = gatheringPriceInfo();
                console.log(collection);
                addInfoToScreen(collection);
                
                document.querySelector("#listWrap").scrollIntoView(false);
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

