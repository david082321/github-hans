// ==UserScript==
// @name         GitHub 漢化外掛程式
// @description  漢化 GitHub 介面的部分選單及內容。
// @copyright    2016, 樓教主 (http://www.52cik.com/)
// @icon         https://assets-cdn.github.com/pinned-octocat.svg
// @version      1.6.4
// @author       樓教主
// @license      MIT
// @homepageURL  https://github.com/52cik/github-hans
// @match        http://*.github.com/*
// @match        https://*.github.com/*
// @require      https://raw.githubusercontent.com/david082321/github-hans/gh-pages/locals.js
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function (window, document, undefined) {
    'use strict';

    var lang = 'zh'; // 中文

    // 2016-04-18 github 將 jquery 以 amd 載入，不暴露到全域了。
    // var $ = require('github/jquery')['default'];

    // 要翻譯的頁面
    var page = getPage();

    transTitle(); // 頁面標題翻譯
    timeElement(); // 時間節點翻譯
    // setTimeout(contributions, 100); // 貢獻日曆翻譯 (日曆是內嵌或ajax的, 所以基於回調事件處理)
    walk(document.body); // 立即翻譯頁面

    // 2017-03-19 github 封鎖 require 改為 Promise 形式的 ghImport
    define('github-hans-ajax', ['./jquery'], function($) {
        $(document).ajaxComplete(function () {
            transTitle();
            walk(document.body); // ajax 請求後再次翻譯頁面
        });
    });
    ghImport('github-hans-ajax')['catch'](function(e) {
        setTimeout(function() { throw e });
    });

    /**
     * 遍歷節點
     *
     * @param {Element} node 節點
     */
    function walk(node) {
        var nodes = node.childNodes;

        for (var i = 0, len = nodes.length; i < len; i++) {
            var el = nodes[i];
            // todo 1. 修復多屬性翻譯問題; 2. 添加事件翻譯, 如論預覽訊息;

            if (el.nodeType === Node.ELEMENT_NODE) { // 元素節點處理

                // 元素節點屬性翻譯
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') { // 輸入框 按鈕 文字域
                    if (el.type === 'button' || el.type === 'submit') {
                        transElement(el, 'value');
                    } else {
                        transElement(el, 'placeholder');
                    }
                } else if (el.hasAttribute('aria-label')) { // 帶提示的元素，類似 tooltip 效果的
                    transElement(el, 'aria-label', true);

                    if (el.hasAttribute('data-copied-hint')) { // 複製成功提示
                        transElement(el.dataset, 'copiedHint');
                    }
                } else if (el.tagName === 'OPTGROUP') { // 翻譯 <optgroup> 的 label 屬性
                    transElement(el, 'label');
                }

                if (el.hasAttribute('data-disable-with')) { // 按鈕等待提示
                    transElement(el.dataset, 'disableWith');
                }

                // 跳過 readme, 文件列表, 程式碼顯示
                if (el.id !== 'readme' && !I18N.conf.reIgnore.test(el.className)) {
                    walk(el); // 遍歷子節點
                }
            } else if (el.nodeType === Node.TEXT_NODE) { // 文字節點翻譯
                transElement(el, 'data');
            }

        }
    }

    /**
     * 獲取翻譯頁面
     */
    function getPage() {
        // 先匹配 body 的 class
        var page = document.body.className.match(I18N.conf.rePageClass);

        if (!page) { // 擴展 url 匹配
            page = location.href.match(I18N.conf.rePageUrl);
        }

        if (!page) { // 擴展 pathname 匹配
            page = location.pathname.match(I18N.conf.rePagePath);
        }

        return page ? page[1] || 'homepage' : false; // 取頁面 key
    }

    /**
     * 翻譯頁面標題
     */
    function transTitle() {
        var title = translate(document.title, 'title');

        if (title === false) { // 無翻譯則退出
            return false;
        }

        document.title = title;
    }


    /**
     * 翻譯節點對應屬性內容
     *
     * @param {object} el 物件
     * @param {string} field 屬性欄位
     * @param {boolean} isAttr 是否是 attr 屬性
     *
     * @returns {boolean}
     */
    function transElement(el, field, isAttr) {
        var transText = false; // 翻譯後的文字

        if (isAttr === undefined) { // 非屬性翻譯
            transText = translate(el[field], page);
        } else {
            transText = translate(el.getAttribute(field), page);
        }

        if (transText === false) { // 無翻譯則退出
            return false;
        }

        // 取代翻譯後的內容
        if (isAttr === undefined) {
            el[field] = transText;
        } else {
            el.setAttribute(field, transText);
        }
    }


    /**
     * 翻譯文字
     *
     * @param {string} text 待翻譯字串
     * @param {string} page 頁面欄位
     *
     * @returns {string|boolean}
     */
    function translate(text, page) { // 翻譯
        var str;
        var _key = text.trim(); // 去除首尾空格的 key
        var _key_neat = _key
            .replace(/\xa0/g, ' ') // 取代 &nbsp; 空格導致的 bug
            .replace(/\s{2,}/g, ' '); // 去除多餘換行空格等字元，(試驗測試階段，有問題再復原)

        if (_key_neat === '') {
            return false;
        } // 內容為空不翻譯

        str = transPage('pubilc', _key_neat); // 公共翻譯

        if (str !== false && str !== _key_neat) { // 公共翻譯完成
            str = transPage('pubilc', str) || str;  // 二次公共翻譯（為了彌補正則部分翻譯的情況）
            return text.replace(_key, str);  // 取代原字元，保留空白部分
        }

        if (page === false) {
            return false;
        } // 未知頁面不翻譯

        str = transPage(page, _key_neat); // 翻譯已知頁面
        if (str === false || str === '') {
            return false;
        } // 未知內容不翻譯

        str = transPage('pubilc', str) || str; // 二次公共翻譯（為了彌補正則部分翻譯的情況）
        return text.replace(_key, str); // 取代原字元，保留空白部分
    }


    /**
     * 翻譯頁面內容
     *
     * @param {string} page 頁面
     * @param {string} key 待翻譯內容
     *
     * @returns {string|boolean}
     */
    function transPage(page, key) {
        var str; // 翻譯結果
        var res; // 正則陣列

        // 靜態翻譯
        str = I18N[lang][page]['static'][key];
        if (str) {
            return str;
        }

        // 正則翻譯
        res = I18N[lang][page].regexp;
        if (res) {
            for (var i = 0, len = res.length; i < len; i++) {
                str = key.replace(res[i][0], res[i][1]);
                if (str !== key) {
                    return str;
                }
            }
        }

        return false; // 沒有翻譯條目
    }


    /**
     * 時間節點翻譯
     */
    function timeElement() {
        if (!window.RelativeTimeElement) { // 防止報錯
            return;
        }

        var RelativeTimeElement$getFormattedDate = RelativeTimeElement.prototype.getFormattedDate;
        var TimeAgoElement$getFormattedDate = TimeAgoElement.prototype.getFormattedDate;
        // var LocalTimeElement$getFormattedDate = LocalTimeElement.prototype.getFormattedDate;

        var RelativeTime = function (str, el) { // 相對時間解析
            if (/^on ([\w ]+)$/.test(str)) {
                return '於 ' + el.title.replace(/ .+$/, '');
            }

            // 使用字典公共翻譯的第二個正則翻譯相對時間
            var time_ago = I18N[lang].pubilc.regexp[1];
            return str.replace(time_ago[0], time_ago[1]);
        };

        RelativeTimeElement.prototype.getFormattedDate = function () {
            var str = RelativeTimeElement$getFormattedDate.call(this);
            return RelativeTime(str, this);
        };

        TimeAgoElement.prototype.getFormattedDate = function () {
            var str = TimeAgoElement$getFormattedDate.call(this);
            return RelativeTime(str, this);
        };

        LocalTimeElement.prototype.getFormattedDate = function () {
            return this.title.replace(/ .+$/, '');
        };

        // 遍歷 time 元素進行翻譯
        // 2016-04-16 github 改版，不再用 time 標籤了。
        var times = document.querySelectorAll('time, relative-time, time-ago, local-time');
        Array.prototype.forEach.call(times, function (el) {
            if (el.getFormattedDate) { // 跳過未註冊的 time 元素
                el.textContent = el.getFormattedDate();
            }
        });
    }


    /**
     * 貢獻日曆 基於事件翻譯
     */
    function contributions() {
        var tip = document.getElementsByClassName('svg-tip-one-line');

        // 等待 IncludeFragmentElement 元素載入完畢後綁定事件
        // var observe = require('github/observe').observe;

        define('github/hans-contributions', ['./observe'], function (observe) {
            observe(".js-calendar-graph-svg", function () {
                setTimeout(function () { // 延時綁定 mouseover 事件，否則沒辦法翻譯
                    var $calendar = $('.js-calendar-graph');
                    walk($calendar[0]); // 翻譯日曆部分

                    $calendar.on('mouseover', '.day', function () {
                        if (tip.length === 0) { // 沒有 tip 元素時退出防止報錯
                            return true;
                        }

                        var data = $(this).data(); // 獲取節點上的 data
                        var $tip = $(tip[0]);

                        $tip.html(data.count + ' 次貢獻 ' + data.date);

                        var rect = this.getBoundingClientRect(); // 獲取元素位置
                        var left = rect.left + window.pageXOffset - tip[0].offsetWidth / 2 + 5.5;

                        $tip.css('left', left);
                    });
                }, 999);
            });
        });

        ghImport('github/hans-contributions')['catch'](function(e) {
            setTimeout(function() { throw e });
        });
    }

})(window, document);
