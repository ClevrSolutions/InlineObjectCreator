define([
	"dojo/_base/declare",
	"mxui/widget/_WidgetBase",
	"dijit/_TemplatedMixin",
	"dojo/_base/lang",
	"dojo/text!InlineObjectCreator/widget/ui/InlineObjectCreator.html",
	"dojo/dom-style",
	"dojo/dom-class",
	"dojo/html",
	"mxui/dom",
	"dojo/json",
	"dojo/_base/fx",
	"dojo/on",
	"dojo/_base/event"
], function (declare, _WidgetBase, _TemplatedMixin, lang, widgetTemplate, domStyle, domClass, html, dom, json, fx, on, event) {
	'use strict';

	return declare('InlineObjectCreator.widget.InlineObjectCreator', [ _WidgetBase, _TemplatedMixin ], {

		templateString: widgetTemplate,
			aftercreatemicroflow : '',
			tabindex : 0,
			entity :'',
			attribute : '',
			ownerattribute: '',
			buttoncaption: '',
			inputcaption: '',
			inputregex : '',
			invalidvalue : '',
			width : 200,
			rows : 1,
			savecaption : "Saving...",
			savedcaption: "Saved",
	
	dataobject : null,
	feedbackNode : null,
	inputNode : null,
	inputNodeInput : null,
	inputNodeTextArea : null,
	buttonNode : null,
	anim :null,
	enterhandle : null,
	exithandle : null,
	
	postCreate : function(){
		//houskeeping
		logger.debug(this.id + ".postCreate");
		
		if (this.rows == 1) {
			this.inputNode = this.inputNodeInput;
			this.domNode.removeChild(this.inputNodeTextArea);
		}
		else {
			this.inputNode = this.inputNodeTextArea;
			this.domNode.removeChild(this.inputNodeInput);
		}
		domStyle.set(this.inputNode, { display : 'block', width : this.width});
		
		if (this.buttoncaption == "")
		domStyle.set(this.buttonNode, "display", "none");
		else {
			this.connect(this.buttonNode, "onclick", this.trigger);
			this.connect(this.buttonNode, "onkeypress", this.keypress);
			this.connect(this.buttonNode, 'onmouseenter', lang.hitch(this, this.buttonHover, true));
			this.connect(this.buttonNode, 'onmouseleave', lang.hitch(this, this.buttonHover, false));
		}
		
		this.connect(this.inputNode, "onkeypress", this.keypress);
		this.enterhandle = on(this.inputNode, 'focus', this.onfocus);
		this.exithandle = on(this.inputNode, 'blur', this.onblur);

		this.connect(this.inputNodeTextArea, "oninput", this.setHeight);
		
		// this.initContext();
		// this.actRendered();
		/* Deprecated function */
	},
	
	setHeight :function() {
		var heightLimit = 500; /* Maximum height: 500px */
		
  	this.inputNodeTextArea.style.height = ""; /* Reset the height*/
  	this.inputNodeTextArea.style.height = Math.min(this.inputNodeTextArea.scrollHeight, heightLimit) + "px";

	},
	
	
	buttonHover : function (enter, e) {
		if (enter == true) {
			domClass.add(this.buttonNode, 'InlineObjectCreatorButtonFocus');
		} else {
			domClass.remove(this.buttonNode, 'InlineObjectCreatorButtonFocus');
		}
	},
	
	onblur : function () {
		if (this.exithandle != null) {
			this.exithandle.remove();
			this.exithandle = null;
		}
			
		if (this.inputNode.value == '') {
			this.inputNode.value = this.inputcaption;
			domClass.add(this.inputNode, 'InlineObjectCreaterPreFocus');
			this.enterhandle = on(this.inputNode, 'focus', this.onfocus.bind(this));
		}
	},
	
	onfocus : function() {
		if (this.enterhandle) {
			this.enterhandle = null;
			domClass.remove(this.inputNode, 'InlineObjectCreaterPreFocus');
			if(this.inputNode.value == this.inputcaption) this.inputNode.value = ''; // only clear this field in case it was set with the placeholder caption
			this.exithandle = on(this.inputNode, 'blur', this.onblur.bind(this));
		}
	},
	
	feedbackError : function(msg, error) {
		var m = msg + (error ? error : "");
		console.error(this.id + " " + m);
		this.feedback(m);
	},
	
	feedback : function(msg) {
		if (msg != '' && msg != null) {
			if (this.anim != null)
				anim.stop();
			
			html.set(this.feedbackNode, msg);
			domStyle.set(this.feedbackNode, {
				height : 'auto', display : 'block'
			});

			fx.animateProperty({
				node : this.feedbackNode,
				properties : { height : 0 },
				duration : 700,
				delay : 2000,
				onEnd : lang.hitch(this, function() {
					domStyle.set(this.feedbackNode, 'display', 'none');
				})
			}).play();
		}
		else
		domStyle.set(this.feedbackNode, 'display', 'none');
	},
	
	keypress : function(e) {
		if (e.keyCode == 13 && (this.rows == 1 || e.ctrlKey == true)) { //multiline needs ctrl key
			this.trigger();
			event.stop(e); // no bubbling
		}
	},
	
	trigger :function() {
		if (this.enterhandle != null) {
			this.onfocus();
			this.inputNode.focus();
			return;
		}
		
		if (this.dataobject == null) {
			this.feedback('No object in context');
			return;
		}
		
		var input = this.inputNode.value;
		if (!input.match(new RegExp(this.inputregex, "i"))) {
			this.feedback(this.invalidvalue);
			return;
		}
		
		this.feedback(this.savecaption);
		mx.data.create({
			entity: this.entity,
			callback: lang.hitch(this, this.created, input)
		});
	},
	
	created : function(value, object) {
		//update ownership
		object.set(this.ownerattribute.split("/")[0], this.dataobject);
		object.set(this.attribute, value);
			mx.data.commit({
				mxobj: object,
				callback: lang.hitch(this, this.invokeMF, object),
				error: lang.hitch(this, this.feedbackError, "Error while saving object")
			});
	},
	
	invokeMF : function(object) {
		//invoke microflow
		if (this.aftercreatemicroflow) {
			mx.data.action({
				params: {
					actionname: this.aftercreatemicroflow,
					applyto: 'selection',
					guids: [ object.getGuid() ]
				},
				error: lang.hitch(this, this.feedbackError, "Error: XAS error executing microflow"),
				callback: lang.hitch(this, function (data) {
					this.feedback(data);
					this.inputNode.value = '';
					this.onblur();
				})
			});
		}
		else
			this.feedback(this.savedcaption);
		this.inputNode.value = '';
		this.setHeight();
	},
	
	applyContext : function(context, callback){
		logger.debug(this.id + ".applyContext"); 
		if (context) 
			this.dataobject = context.getTrackId();
		else
			logger.warn(this.id + ".applyContext received empty context");
		
		this.inputNode.value = '';
		this.onblur();
		
		callback && callback();
	},
	
	uninitialize : function(){
	}
		});
	});

require([ "InlineObjectCreator/widget/InlineObjectCreator" ]);
