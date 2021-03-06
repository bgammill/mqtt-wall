import {EventEmitter} from './utils.js';
import {WallClient} from './client.js';

export var UI = {};

UI.setTitle = function (topic) {
    document.title = "MQTT Wall" + (topic ? (" for " + topic) : "");
};
 
UI.toast = function (message, type = "info", persistent = false) {
    return new Toast(message, type, persistent);
};

class Toast {

    constructor (message, type = "info", persistent = false) {

        this.$root = $("<div class='toast-item'>")
            .text(message)
            .addClass(type)
            .hide()
            .appendTo("#toast")
            .fadeIn();

        if (persistent) {
            this.$root.addClass("persistent");
        } else {
            setTimeout(() => { this.hide(); }, 5000);
        }
    }

    hide () {
        this.$root.slideUp().queue(() => { this.remove(); });
    }

    remove () {
        this.$root.remove();
    }

    setMessage (message) {
        this.$root.text(message);
    }
}

export class MessageLine {

    constructor(topic){
        this.topic = topic;
        this.counter = 0;
        this.isNew = true;
        this.init();
    }

    init() {
        this.$root = $("<article class='message'>");

        var header = $("<header>").appendTo(this.$root);

        $("<h2>")
            .text(this.topic)
            .appendTo(header);

        if (window.config.showCounter) {
            this.$counterMark = $("<span class='mark counter' title='Message counter'>0</span>")
                .appendTo(header);
        }

        this.$retainMark = $("<span class='mark retain' title='Retain message'>R</span>")
            .appendTo(header);

        this.$qosMark = $("<span class='mark qos' title='Received message QoS'>QoS</span>")
            .appendTo(header);

        this.$payload = $("<p>").appendTo(this.$root);
    }

    set isRetained(value) {
        this.$retainMark[value ? 'show' : 'hide']();
    }

    set isSystemPayload(value) {
        this.$payload.toggleClass("sys", value);
    }

    highlight(line = false) {
        (line ? this.$root : this.$payload)
            .stop()
            .css({backgroundColor: "#0CB0FF"})
            .animate({backgroundColor: "#fff"}, 2000);
    }

    update(payload, retained, qos) {
        this.counter ++;
        this.isRetained = retained;

        if (this.$counterMark) {
            this.$counterMark.text(this.counter);
        }
        
        if (this.$qosMark) {
            if (qos == 0) {
                this.$qosMark.hide();
            } else {
                this.$qosMark.show();
                this.$qosMark.text(`QoS ${qos}`);
                this.$qosMark.attr("data-qos", qos);
            }
        }

        if (payload == "") 
        {
            payload = "NULL";
            this.isSystemPayload = true;
        }
        else
        {
            this.isSystemPayload = false;    
        }

        this.$payload.text(payload);
        this.highlight(this.isNew);

        if (this.isNew) {
            this.isNew = false;
        }       
    }
}

export class MessageContainer {

    constructor($parent) {
        this.sort = 'Alphabetically';
        this.$parent = $parent;
        this.init();
    }

    init() {
        this.reset();
    }

    reset() {
        this.lines = {};
        this.topics = [];
        this.$parent.html("");
    }

    update (topic, payload, retained, qos) {

        if (!this.lines[topic]) {

            var line = new MessageLine(topic, this.$parent);

            this[`addLine${this.sort}`](line);
            this.lines[topic] = line;
        }

        this.lines[topic].update(payload, retained, qos);
    }

    addLineAlphabetically (line) {

        if (this.topics.length == 0) 
        {
            this.addLineChronologically(line);
            return;
        }

        var topic = line.topic;

        this.topics.push(topic);
        this.topics.sort();

        var n = this.topics.indexOf(topic);

        if (n == 0){
            this.$parent.prepend(line.$root);
            return;    
        }

        var prev = this.topics[n - 1];
        line.$root.insertAfter(this.lines[prev].$root);
    }

    addLineChronologically (line) {
        this.topics.push(line.topic);
        this.$parent.append(line.$root);
    }
}

MessageContainer.SORT_APLHA = "Alphabetically";
MessageContainer.SORT_CHRONO = "Chronologically";

export class Footer {

    set clientId(value) {
        $("#status-client").text(value);
    }

    set uri(value) {
        $("#status-host").text(value);
    }

    set state(value) {
        let text, className;

        switch (value) {
            case WallClient.STATE.NEW:
                text = "";
                className = "connecting";
                break;
            case WallClient.STATE.CONNECTING:
                text = "connecting...";
                className = "connecting";
                break;
            case WallClient.STATE.CONNECTED:
                text = "connected";
                className = "connected";
                break;
            case WallClient.STATE.RECONNECTING:
                text = "reconnecting...";
                className = "connecting";
                break;
            case WallClient.STATE.ERROR:
                text = "not connected";
                className = "fail";
                break;
            default:
                throw new Error("Unknown WallClient.STATE")
        }

        if (this.reconnectAttempts > 1) {
            text += ` (${this.reconnectAttempts})`;
        }

        $("#status-state").removeClass().addClass(className);
        $("#status-state span").text(text);
    }
}

export class Toolbar extends EventEmitter {

    constructor (parent) {
        super();
        
        this.$parent = parent;
        this.$topic = parent.find("#topic");
        
        this.initEventHandlers();
        this.initDefaultTopic();
    }

    initEventHandlers () {
        let inhibitor = false;

        this.$topic.keyup((e) => {
            if(e.which === 13) { // ENTER
                this.$topic.blur();
            }  

            if (e.keyCode === 27) { // ESC
                inhibitor = true;
                this.$topic.blur();
            }
        });

        this.$topic.focus((e) => {
            inhibitor = false;
        });

        this.$topic.blur((e) => {
            if (inhibitor) {
                this.updateUi(); // revert changes
            } else {
                this.inputChanged();
            } 
        });
    }

    inputChanged () {
        var newTopic = this.$topic.val(); 

        if (newTopic === this._topic) {
            return;
        }

        this._topic = newTopic;
        this.emit("topic", newTopic);
    } 

    initDefaultTopic () {
        // URL hash 
        if (location.hash !== "") {
            this._topic = location.hash.substr(1);
        } else {
            this._topic = config.defaultTopic || "/#";
        }

        this.updateUi();
    }

    updateUi () {
        this.$topic.val(this._topic);
    }

    get topic () {
        return this._topic;
    }

    set topic (value) {
        this._topic = value;
        this.updateUi();
        this.emit("topic", value);
    }
}