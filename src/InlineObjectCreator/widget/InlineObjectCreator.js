dojo.provide("InlineObjectCreator.widget.InlineObjectCreator");

if (!dojo.getObject("widgets.widgets"))
	mendix.dom.insertCss(mx.moduleUrl('InlineObjectCreator','widget/ui/InlineObjectCreator.css'));

mendix.widget.declare('InlineObjectCreator.widget.InlineObjectCreator', {
	addons       : [dijit._Templated, mendix.addon._Contextable],
	templatePath : dojo.moduleUrl('InlineObjectCreator', "widget/ui/InlineObjectCreator.html"),
    inputargs: { 
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
			savedcaption: "Saved"
    },
	
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
		dojo.style(this.inputNode, { display : 'block', width : this.width});
		
		if (this.buttoncaption == "")
			dojo.style(this.buttonNode, "display", "none");
		else {
			this.connect(this.buttonNode, "onclick", this.trigger);
			this.connect(this.buttonNode, "onkeypress", this.keypress);
			this.connect(this.buttonNode, 'onmouseenter', dojo.hitch(this, this.buttonHover, true));
			this.connect(this.buttonNode, 'onmouseleave', dojo.hitch(this, this.buttonHover, false));
		}
		
		this.connect(this.inputNode, "onkeypress", this.keypress);
		this.enterhandle = dojo.connect(this.inputNode, 'onfocus', this, this.onfocus);
		this.exithandle = dojo.connect(this.inputNode, 'onblur', this, this.onblur);

		this.connect(this.inputNodeTextArea, "oninput", this.setHeight);
		
		this.initContext();
		this.actRendered();
	},
	
	setHeight :function() {
		var heightLimit = 500; /* Maximum height: 500px */
		
  	this.inputNodeTextArea.style.height = ""; /* Reset the height*/
  	this.inputNodeTextArea.style.height = Math.min(this.inputNodeTextArea.scrollHeight, heightLimit) + "px";

	},
	
	
	buttonHover : function (enter, e) {
		if (enter == true) {
			mendix.dom.addClass(this.buttonNode, 'InlineObjectCreatorButtonFocus');
		} else {
			mendix.dom.removeClass(this.buttonNode, 'InlineObjectCreatorButtonFocus');
		}
	},
	
	onblur : function () {
		if (this.exithandle != null) {
			this.disconnect(this.exithandle);
			this.exithandle = null;
		}
			
		if (this.inputNode.value == '') {
			this.inputNode.value = this.inputcaption;
			dojo.addClass(this.inputNode, 'InlineObjectCreaterPreFocus');
			this.enterhandle = dojo.connect(this.inputNode, 'onfocus', this, this.onfocus);
		}
	},
	
	onfocus : function() {
		dojo.disconnect(this.enterhandle);
		this.enterhandle = null;
		dojo.removeClass(this.inputNode, 'InlineObjectCreaterPreFocus');
		if(this.inputNode.value == this.inputcaption) this.inputNode.value = ''; // only clear this field in case it was set with the placeholder caption
		this.exithandle = dojo.connect(this.inputNode, 'onblur', this, this.onblur);
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
			
			dojo.html.set(this.feedbackNode, msg);
			dojo.style(this.feedbackNode, {
				height : 'auto', display : 'block'
			});

			dojo.animateProperty({
				node : this.feedbackNode,
				properties : { height : 0 },
				duration : 700,
				delay : 2000,
				onEnd : dojo.hitch(this, function() {
					dojo.style(this.feedbackNode, 'display', 'none');
				})
			}).play();
		}
		else
			dojo.style(this.feedbackNode, 'display', 'none');
	},
	
	keypress : function(e) {
		if (e.keyCode == 13 && (this.rows == 1 || e.ctrlKey == true)) { //multiline needs ctrl key
			this.trigger();
			dojo.stopEvent(e); //no bubbling
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
		mx.processor.createObject({
			"className"	: this.entity,
			"callback"	: dojo.hitch(this, this.created, input),
			"context"	: null
		});
	},
	
	created : function(value, object) {
		//update ownership
		object.setAttribute(this.ownerattribute.split("/")[0], this.dataobject);
		object.setAttribute(this.attribute, value);
		var me = this;
		object.save({
			error : dojo.hitch(this, this.feedbackError, "Error while saving object"),
			callback : dojo.hitch(me, me.invokeMF, object)
		});
	},
	
	invokeMF : function(object) {
		//invoke microflow
		if (this.aftercreatemicroflow) {
			mx.processor.xasAction({
				error       : dojo.hitch(this, this.feedbackError, "Error: XAS error executing microflow"),
				callback    : dojo.hitch(this, function(data) {
					this.feedback("" + dojo.fromJson(data.xhr.responseText).actionResult);				
					this.inputNode.value = '';
					this.onblur();
				}),
				actionname  : this.aftercreatemicroflow,
				applyto     : 'selection',
				guids       : [object.getGUID()]
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
			this.dataobject = context.getActiveGUID();
		else
			logger.warn(this.id + ".applyContext received empty context");
		
		this.inputNode.value = '';
		this.onblur();
		
		callback && callback();
	},
	
	uninitialize : function(){
	}
});