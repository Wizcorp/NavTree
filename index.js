var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;

var STATE_CLOSED = 0;
var STATE_PREPARED = 1;
var STATE_OPENED = 2;


var isNavigationSet = false;

// history object

function NavTreeHistory(bindToNavigator) {
	EventEmitter.call(this);
	var self = this;

	this.nodes = [];
	this.index = -1;
	this._currentHash = 0;
	this._bindToNavigator = !!bindToNavigator;

	if (bindToNavigator && isNavigationSet) {
		return console.warn("The navigator is already bound to a NavTree");
	}

	if (bindToNavigator) {
		isNavigationSet = true;
		window.onhashchange = function () {

			if (self._lockHashUpdate) {
				self._lockHashUpdate = false;
				return;
			}

			var newHash = self._getLocationHash();

			if (newHash > self._currentHash) {
				self.emit('forward');
			} else {
				self.emit('backward');
			}
			self._currentHash = newHash;
		};
	}
}

inherits(NavTreeHistory, EventEmitter);

NavTreeHistory.prototype._moveTo = function (index) {
	this.index = index;
	this.emit('move', this.index, this.nodes[this.index]);
};


NavTreeHistory.prototype.current = function () {
	return this.nodes[this.index];	// undefined if the list is empty
};


NavTreeHistory.prototype.isEmpty = function () {
	return this.nodes.length === 0;
};


NavTreeHistory.prototype.clear = function () {
	this.nodes = [];
	this._moveTo(-1);
	this._currentHash = 0;
};


NavTreeHistory.prototype.clearPast = function () {
	if (this.index > 0) {
		this.nodes.splice(0, this.index);
		this._moveTo(0);
		this._currentHash = 0;
	}
};


NavTreeHistory.prototype.clearFuture = function () {
	this.nodes.splice(this.index + 1);
	this._currentHash = Date.now();
};


NavTreeHistory.prototype.resetToCurrent = function () {
	var node = this.nodes[this.index];

	if (node) {
		this.nodes = [node];
		this._moveTo(0);
	} else {
		this.clear();
	}
	this._currentHash = 0;
};


NavTreeHistory.prototype.add = function (node) {
	var index = this.index + 1;

	// drop all nodes starting at the new index, and add the node to the end

	this.nodes.splice(index, this.nodes.length, node);

	// increment the index

	this._moveTo(index);
	this._setLocationHash();
};


NavTreeHistory.prototype.replace = function (node, protectFuture) {
	var index = this.index;

	if (index < 0) {
		// if there were no elements before, we want to write to index 0

		index = 0;
	}

	if (protectFuture) {
		this.nodes[index] = node;
	} else {
		// drop all nodes starting at index, and add the node to the end

		this.nodes.splice(index, this.nodes.length, node);
	}

	this._moveTo(index);
};


/**
 * Returns the value of the location hash.
 * @return {string} Hash value with '#' prefix discarded.
 */
NavTreeHistory.prototype._getLocationHash = function () {
	return window.location.hash.substring(1);
};


/**
 * Updates the location hash with the specified string.
 */
NavTreeHistory.prototype._setLocationHash = function () {
	if (this._bindToNavigator) {
		this._currentHash = Date.now();
		this._lockHashUpdate = true;
		window.location.hash = this._currentHash;
	}
};




NavTreeHistory.prototype.back = function () {
	var index = this.index - 1;
	var node = this.nodes[index];

	if (index >= -1) {
		this._moveTo(index);

		if (node) {
			return node;
		}
	}

	// else undefined
};


NavTreeHistory.prototype.forward = function () {
	var index = this.index + 1;
	var node = this.nodes[index];

	if (node) {
		this._moveTo(index);

		return node;
	}

	// else undefined
};


/**
 * @class
 * @classDesc nav tree implementation
 * @param {Object} [options]
 * @param {Boolean} [options.createOnRegister=false]
 * @param {Boolean} [options.bindToNavigator=false]
 * @param {Object} [creationOptions]
 */
function NavTree(options, creationOptions) {
	EventEmitter.call(this);

	var self = this;
	this.tree = {};             // collection of objects to which we can navigate, indexed by name
	this.nodeQueue = [];        // FIFO
	this.options = options || {};
	this.creationOptions = creationOptions || {};
	this.opening = false;

	this.stack = new NavTreeHistory(this.options.bindToNavigator);

	if (!this.options.hasOwnProperty('createOnRegister')) {
		this.options.createOnRegister = false;
	}

	this.stack.on('forward', function () {
		self.forward();
	});

	this.stack.on('backward', function () {
		self.back();
	});

}


inherits(NavTree, EventEmitter);
module.exports = NavTree;


NavTree.prototype.branch = function (creationOptions, cbCollapse) {
	// create a new NavTree

	var subTree = new NavTree(this.options, creationOptions);

	// give the new tree access to the same items that the source tree has access to

	subTree.tree = this.tree;
	subTree.cbCollapse = cbCollapse;

	return subTree;
};


NavTree.prototype.register = function (name, item, options) {
	this.tree[name] = item;
	options = options || {};
	if ((this.options.createOnRegister && options.create !== false) || options.create) {
		this._createItem(name);
	}
};


NavTree.prototype.getItem = function (name) {
	return this.tree[name];
};


NavTree.prototype._createNode = function (name, params, closeCb) {
	var item = this.tree[name];

	if (!item) {
		console.error('NavTree item', name, 'not found.');
		return null;
	}

	if (!item._isCreated) {
		this._createItem(name);
	}

	return {
		name: name,
		params: params,
		item: item,
		state: STATE_CLOSED,
		closeCb: closeCb
	};
};


NavTree.prototype.rebindItem = function (item) {
	var navTree = this;

	item.getNavTree = function () {
		return navTree;
	};
};


NavTree.prototype._createItem = function (name) {
	var item = this.tree[name];
	this.rebindItem(item);

	if (item.create) {
		item.create(this.creationOptions, name);
	}

	item._isCreated = true;
};


NavTree.prototype._closeNode = function (node, cb) {
	var self = this;
	function closeItemCb() {
		node.state = STATE_CLOSED;

		if (node.closeCb) {
			node.closeCb(self._response);
			self._response = null;
			node.closeCb = null;
		}

		cb();
	}


	if (node && node.state !== STATE_CLOSED) {
		// only non-closed nodes can be closed

		this.emit('close', node.name);

		if (node.item.close) {
			// if the supplied close function has 2 arguments, we treat the second argument
			// as a callback function
			if (node.item.close.length === 2) {
				return node.item.close(node.item.params, closeItemCb);
			}

			node.item.close(node.item.params);
		}

		return closeItemCb();
	}

	cb();
};


NavTree.prototype._closeCurrentNode = function (cb) {
	var currentNode = this.stack.current();
	if (!currentNode || !currentNode.item) {
		return cb();
	}
	currentNode.item.emit('closing', currentNode.params);
	this._closeNode(currentNode, function () {
		currentNode.item.emit('closed', currentNode.params);
		cb();
	});
};


NavTree.prototype._openNode = function (node) {
	// call the beforeopen event if the node wasn't prepared yet

	var replacement, replacementNode;

	if (node.state === STATE_CLOSED && node.item.beforeopen) {
		// replacement is an object { name: 'item name', params: { anything } }

		replacement = node.item.beforeopen(node.params);

		if (replacement) {
			replacementNode = this._createNode(replacement.name, replacement.params);
		}
	}

	// beforeopen event handlers could have injected a node, meaning we have to postpone opening this node

	if (replacementNode) {
		// enqueue the node (first in line), and tag it as prepared, since beforeopen() has been called

		node.state = STATE_PREPARED;

		this.nodeQueue.unshift(node);

		node = this._openNode(replacementNode);

	} else {
		// call item.open() and set the node state to opened.

		node.state = STATE_OPENED;

		this.rebindItem(node.item);

		node.item.open(node.params);

		this.emit('open', node.name, node.params);
	}

	this.opening = false;
	return node;
};


NavTree.prototype._transitionNodes = function (from, to, transition) {

	if (from && from.name === to.name) {
		from.item.emit('closing', from.params);
		from.item.emit('closed', from.params);
		from = null;
	}

	if (!from) {
		to.item.emit('opening', to.params);

		this._openNode(to);

		return window.setTimeout(function () {
			to.item.emit('opened', to.params);
		}, 0);
	}

	var self = this;

	from.item.emit('closing', from.params);
	to.item.emit('opening', to.params);

	function closeNode() {
		self._closeNode(from, function () {
			from.item.emit('closed', from.params);
			self._openNode(to);
			to.item.emit('opened', to.params);
		});
	}

	return window.setTimeout(function () {
		if (!transition) {
			return closeNode();
		}

		from.item.emit('moving');
		to.item.emit('moving');

		transition(from.item, to.item, function () {
			from.item.emit('moved', from.params);
			to.item.emit('moved', to.params);
			window.setTimeout(closeNode, 0);
		});

	}, 0);
};


/**
 * NavTree.open opens a node with the given parameters.
 * If there is an active node, it will be closed automatically.
 * If cb is given, it will be called on close.
 */

NavTree.prototype.open = function (name, params, transition, cb) {
	if (this.opening) {
		return false;
	}

	this.opening = true;
	var from = this.stack.current();
	var to = this._createNode(name, params, cb);

	if (to) {
		this._transitionNodes(from, to, transition);
		this.stack.add(to);
		return true;
	}

	this.opening = false;
	return false;
};


NavTree.prototype.enqueue = function (name, params, transition, cb) {
	if (this.stack.isEmpty()) {
		// nothing is active now, so we instantly open the node

		this.open(name, params, transition, cb);
	} else {
		// something is already active, so we append to the end of the queue

		var node = this._createNode(name, params, cb);

		if (node) {
			this.nodeQueue.push({ node: node, transition: transition });
		}
	}
};


NavTree.prototype.replace = function (name, params, transition, cb) {
	// like open, but replaces the current node in the history stack
	// ignores the queue
	if (this.opening) {
		return false;
	}

	this.opening = true;
	var from = this.stack.current();
	var to = this._createNode(name, params, cb);

	if (to) {
		this._transitionNodes(from, to, transition);
		this.stack.replace(to);
		return true;
	}

	this.opening = false;
	return false;
};


NavTree.prototype.back = function (transition) {
	if (this.opening) {
		return false;
	}

	this.opening = true;
	var from = this.stack.current();
	var to = this.stack.back();

	if (to) {
		this._transitionNodes(from, to, transition);
		return true;
	} else {
		this.stack.forward();
	}

	this.opening = false;
	return false;
};


NavTree.prototype.forward = function (transition) {
	if (this.opening) {
		return false;
	}

	this.opening = true;
	var from = this.stack.current();
	var to = this.stack.forward();

	if (to) {
		this._transitionNodes(from, to, transition);
		return true;
	}

	this.opening = false;
	return false;
};


NavTree.prototype.close = function (response) {
	// manual close
	// that means we open the first queued node, or if none are available, we consider this a "back" request.

	// try to open a queued node

	var queue = this.nodeQueue.shift();

	if (queue) {

		this.replace(queue.node.name, queue.node.params, queue.transition);

	} else {
		// there was no queued node, so we execute a back() request

		this._response = response;
		var wentBack = this.back();

		// drop everything after the current node (if there is no current node, it will just clear all)

		this.stack.clearFuture();

		if (!wentBack) {
			var self = this;

			// if there was no node to go back to, the navTree can be considered empty

			this._closeCurrentNode(function () {
				self.stack.clear();

				if (self.cbCollapse) {
					// call the collapse callback

					self.cbCollapse(response);
				}
			});
		}
	}
};


NavTree.prototype.clearHistory = function () {
	// cleanup function to be called whenever hitting a point
	// where no back-option is available, like a main-screen.

	this.stack.resetToCurrent();
};
