// ==UserScript==
// @name        부동산 매물 가격 필터 for 
// @namespace   Violentmonkey Scripts
// @match       https://new.land.naver.com/complexes*
// @version     0.1
// @author      cheesy
// @description Please use with violentmonkey
// @downloadURL https://raw.githubusercontent.com/cheesechoi/aptMiner/main/land.priceParser.plugin.js
// @updateURL   https://raw.githubusercontent.com/cheesechoi/aptMiner/main/land.priceParser.plugin.js
// ==/UserScript==
  
function waitUntilAptListLoaded() {
  var loadingClass = document.querySelector("#complexOverviewList > div > div.item_area > div");
  if (!loadingClass || loadingClass.className == "loading") {
    window.setTimeout(waitUntilAptListLoaded, 1000);
  }
  return;  
}

function checkMandantoryCondition(size) {
  // 35평 미만
  if (/\d+/g.exec(size) > (35 * 3.3)) {
    //console.log('Filtered by size - ', size);
    return false;
  }
  // todo : 300세대 미만, 용적률, 기타등등
  return true;
}

function checkItemCondition(tradeType, floor) {
 
    //매매, 전세
    if (tradeType != "전세" && tradeType != "매매") {
      //console.log('Filtered by trade type - ', tradeType);
      return false;
    }

    //// 층
    // 층 명확하지 않은 것 제외
    var _floorInfo = floor.replace("층", "").split('/'); // 
    if ( _floorInfo[0] == "저" || _floorInfo[0] == "고") {
      //console.log('Filtered by floor - ', _floorInfo);
      return false;
    }
    // 1층, 탑층 제외
    if ( _floorInfo[0] == "1" || _floorInfo[0] == _floorInfo[1]) {
      //console.log('Filtered by floor - ', _floorInfo);
      return false;
    }

    // 5층 이상 건물에서 3층 미만 제외
    if ( _floorInfo[1] >= 5 && _floorInfo[0] <= 3) {
      //console.log('Filtered by floor - ', _floorInfo);
      return false;
    }

    return true;
}

function parsePrice(tradePrice) {
  tradePrice = tradePrice.replace(" ", "").replace(",", "");
  return parseInt(tradePrice.split("억")[0]*10000) + (parseInt(tradePrice.split("억")[1]) || 0);  
}

function getPrice_WeolbuStandard() {

  var dictPricePerSize = {};
  
  document.querySelectorAll("#articleListArea > div").forEach( function (ele) {
    //console.log(ele);
    var size = ele.querySelectorAll("div.info_area .line .spec")[0].innerText.split(", ")[0]; // 103/84m^2
    var tradeType = ele.querySelector("div.price_line .type").innerText; // 매매, 전세
    var floor = ele.querySelectorAll("div.info_area .line .spec")[0].innerText.split(", ")[1]; // 3/10층
    var tradePrice = parsePrice(ele.querySelector("div.price_line .price").innerText); // 141000
    var spec = ele.querySelectorAll("div.info_area .line .spec")[1].innerText; // 확장올수리, 정상입주, 수내중학군

    if(!checkMandantoryCondition(size)) {
      return;
    }
    if (!(size in dictPricePerSize))
      dictPricePerSize[size] = { '매매':null, '전세':null, '갭':null, '전세가율':null };

    if(!checkMandantoryCondition(tradeType, floor)) {
      return;
    }
    
    if ( (dictPricePerSize[size][tradeType] == null)
              || (tradeType == "매매" && dictPricePerSize[size][tradeType] > tradePrice)
              || (tradeType == "전세" && dictPricePerSize[size][tradeType] < tradePrice))
    {
        dictPricePerSize[size][tradeType] = tradePrice;
    }
    
    if (dictPricePerSize[size]['매매'] & dictPricePerSize[size]['전세']) {
      dictPricePerSize[size]['갭'] = dictPricePerSize[size]['매매'] - dictPricePerSize[size]['전세'];
      dictPricePerSize[size]['전세가율'] = parseInt((dictPricePerSize[size]['전세'] / dictPricePerSize[size]['매매'])*100)+"%";
    }
  });
  
  return dictPricePerSize;
}

function addInfoToScreen(infos) {
    
    for (let size in infos) {
      var screenInfo = document.querySelectorAll("#summaryInfo > div.complex_summary_info > div.complex_trade_wrap > div > dl");
      var priceInfo = "";
      priceInfo += (infos[size]['매매']  ?infos[size]['매매']    :"0") + " / ";
      priceInfo += (infos[size]['전세']  ?infos[size]['전세']    :"0");
      if (infos[size]['매매'] && infos[size]['전세']) {
        priceInfo += " (" + (infos[size]['갭']    ?infos[size]['갭']     :"-") +", ";
        priceInfo +=       (infos[size]['전세가율']?infos[size]['전세가율']:"-")+")";
      }
      
      var dl = Array.from(screenInfo).find(el => el.textContent.includes(size));
      if (!dl) {
        var cloned = document.querySelector("#summaryInfo > div.complex_summary_info > div.complex_trade_wrap > div > dl:nth-child(1)").cloneNode(true);
        cloned.getElementsByClassName("title")[0].innerText = size;
        cloned.getElementsByClassName("data")[0].innerText = priceInfo;
        document.querySelector("#summaryInfo > div.complex_summary_info > div.complex_trade_wrap > div").appendChild(cloned);
      }
      else {
        dl.getElementsByClassName("data")[0].innerText = priceInfo;
      }
    }
}

function sortOnKeys(dict) {

    var sorted = [];
    for(var key in dict) {
        sorted[sorted.length] = key;
    }
  
    sorted.sort(function(a, b) {
      return (parseInt(/\d+/g.exec(a), 10) - parseInt(/\d+/g.exec(b), 10));      
    });

    var tempDict = {};
    for(var i = 0; i < sorted.length; i++) {
        tempDict[sorted[i]] = dict[sorted[i]];
    }

    return tempDict;
}


var global_apt_height = 0;

function addObserverIfDesiredNodeAvailable() {
  
  var target = document.getElementsByClassName('map_wrap')[0];
  if (!target)
    return;

  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      [].slice.call(mutation.addedNodes).forEach(function (addedNode) {
        
        //console.log(addedNode.classList);
        if (!addedNode.classList
            || (!addedNode.classList.contains('infinite_scroll') && !addedNode.classList.contains('item'))) {
          return;
        }
        
        // 아파트 선택 취소하는 경우 예외처리
        if (document.querySelector("#complexOverviewList > div > div.item_area > div") == null) {
          global_apt_height = 0;
          return;
        }


        result = getPrice_WeolbuStandard();
        result = sortOnKeys(result);
        addInfoToScreen(result);

        //console.log('result ', result);
        document.querySelector("#complexOverviewList > div > div.item_area > div").scrollTop = 
          global_apt_height = document.querySelector("#complexOverviewList > div > div.item_area > div").scrollHeight;
        
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
