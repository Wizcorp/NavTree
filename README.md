# NavTree

NavTree is a FrontEnd component that is designed to be used with WUIView and other items. It allows a game developer
to seamlessly move between different views within a single-page application. This is because the
entire application, with all of its views, is loaded on program launch. NavTree allows views to be
navigated from based on items registered with a certain name.

## Motivation for NavTree

Most of the applications we make here at Wizcorp are single-page games, making it very important
that switching between views is a smooth, efficient user experience. Unfortunately, DOM operations
on a large set of HTML is often extremely inefficient. This problem is addressed by NavTree, as it
allows the programmer to register different views (often best done on program launch or on an AJAX
GET) and then later open them. In this way, the　programmer can create rich and complex views that
have their own sub-views, and navigate to them based on game-driven events.

NavTree will also allow the programmer to return to previously viewed items through the back
function.

## Creating a NavTree

Creating a NavTree element is very easy! All you need to do is call the constructor, and
pass options that you need for your application.

```javascript
var NavTree = require('NavTree');

var navTree = new NavTree({ createOnRegister: true, bindToNavigator: true }, creationOptions);
```

Here we see that the constructor for NavTree takes a few options. The options in the first
parameter are discussed below. The creationOptions object is passed to the item when its create
function is executed. If creationOptions contains 'create: true', then the item's create function
will be called and the 'created' event will be emitted.

### Constructor options

#### bindToNavigator

This option, if set to true, will tell NavTree to bind it's internal stack to track changes related
to the [window.location][0]. The default value of this is false, so normally NavTree will not track
changes to the window.location object.

[0]: https://developer.mozilla.org/en-US/docs/Web/API/window.location?redirectlocale=en-US&redirectslug=DOM%2Fwindow.location


### createOnRegister

When this option is set to true, NavTree will create an item in the tree on every call
to the function register. This is disabled by default.

### NavTree Operations

NavTree allows for a rich set of operations that the programmer can use to add and
interact with WUIView and other items.

#### register

This is one of the primary operations of NavTree. The register function will allow you to
register a new item or view. Often, this method is called on program launch or during loading.

Calling the method:

```javascript
navTree.register(viewName, newItemElement, creationOptions);
```

In the above code, a view is registered under the tag viewName. It is then stored in the NavTree,
where it can later be opened or closed.

#### open

When the open function is called, the newItemElement will be displayed and receive the 'opened'
event. The open function should only be called on views which have already been registered with
the tree. **It is an error to try and open an item that has not been properly registered.**

Calling the method:

```javascript
navTree.open(viewName, parameters, transitionFunction, closeCallBack);
```

In this example, viewName is a string that represents the registered tag of the item. The
rest of the parameters of this function are all optional.

Parameters can specify an object of parameters to be passed on the item's open function. Please
note that these parameters are also included on the 'open' event, as described below. Transition
is a function in the form transition(fromElement, toElement, function). The function provided in
the transitionFunction parameter should try to capture the 'moved' and 'closed' events, to
allow for custom transition logic.

The final parameter is a function that can be called when this view is closed. Please read
more about the closed event below.


#### close

The close method will close the currently open item. If any nodes have been queued through
the enqueue method, the first one in the queue (a first-in, first-out queue) will be displayed.
If there are no queued nodes, it will perform a back operation. Calling this method will emit a
'close' event. In addition, the callback specified in open will be invoked, if it exists.

The optional parameter in close will be passed to the callback function specified in open.
The close method on the registered item will also be called, if it exists.

Calling the method:

```javascript
navTree.close(responseObject);
```


#### getItem

This method simply retrieves a reference to the registered item, specified by the tag provided. It might
return undefined, if the provided tag is not associated with any known item. In general, this function
should not be necessary since the preferred way for item to consume NavTree events is using
the Events (see the example).


Calling the method:


```javascript
var someItem = navTree.getItem(tagName);
```

#### branch

This function can be called to create a sub-tree under an existing NavTree. The use case for
creating a branch, is creating a group of logically connected items. The closeCallback function
is ran when the close method is called.

Calling the method:

```javascript
var newNavTree = navTree.branch(creationOptions, closeCallback)
```

#### back

The back method will return the display to the previous item, if one exists. The method
returns a boolean on whether a back operation was successful or not. Please see the open method for
more information about transitionFunction.

Calling the method:

```javascript
var wentBack = navTree.back(transitionFunction);
```

#### forward

The forward method is essentially the opposite of a back method. It will increase the index and
return the next node, if one exists. Note that this method does not serve any function if back has
not been called on the navTree. See the open method for more information about transactionFunction.

Calling the method:

```javascript
var wentForward = navTree.forward(transitionFunction);
```

#### enqueue

This function works almost identically to open, except that the node is not actually opened. The
create function on the item is called, but the open event is not emitted, and the view is not
displayed. See the open method for more information about the parameters.

Calling the method:

```javascript
navTree.enqueue(viewName, parameters, transitionFunction, closeCallBack);
```

#### replace

This function also works like open, except that it disregards the queue (new items can enter the
queue through enqueue). A new node is created in the tree, immediately displayed and replaces the currently
open existing node (if it exists) in the NavTree history. Please read the open method for more
information regarding the parameters.

Calling the method:

```javascript
navTree.replace(viewName, parameters, transitionFunction, closeCallBack);
```
#### clearHistory

This is a cleanup function that should be called when there is no item to return to. Normally,
NavTree will call this function internally. This should only be called if you want to clear the
history excluding the current navigation item. Note that this cannot be undone.

Calling the method:

```javascript
navTree.clearHistory();
```

### NavTree Events

NavTree inherits from [EventEmitter][0] and emits numerous events that can be consumed by
the registered items. Below there is a discussion of each in detail.

#### open

The open event is emitted when a request is made to open a particular item. The params
specified in the 'open' method are passed along with the event. Items can consume this event to
know that soon they will be displayed.

#### opening

The opening event is emitted when the item is actually in the process of being transitioned to.
This event is often useful for data processing or pre-rendering controls. The parameters specified
in the open method (or enqueue method) are emitted along with this event.

#### opened

The opened event is emitted when the item has completed loading. This event is useful for lazy
loading and for loading animations. This is, of course, because there is no purpose in displaying
an animation before it has actually opened.

#### close

The close event, like the open event, is emitted immediately after a request to close a WUIView
has been made. The parameters specified in open or enqueue are emitted along with this event.
This event is emitted on any transitioning of views, whether through opening a new item or
calling the close method directly.

#### closing

The closing event is emitted when the NavTree has started to close the current item. It is useful to
put tear-down logic such as closing images, freeing resources or otherwise getting rid of temporary
views in the handler for this event. An example of what you might put in the event handler for this
event is to call the stop function of a spinner. The parameters passed in on an enqueue,
replace or open are emitted along with this event.

#### closed

The closed event is emitted when the NavTree has finished closing the current item. The parameters
specified in the open, enqueue or replace method are emitted along with this event. This event
is the last chance to cleanup unwanted data. An example of what you might put in an event handler
is clean-up logic for a Canvas animation.


### NavTree Example

In this simple example, we use the WUIView component and NavTree to create a few items, register.
them in a NavTree, and then navigate to them.

```javascript
(function (window) {

		// include all component needed using Component
		var NavTree = require('NavTree');
		var WUIView = require('WUIView');
		var WuiButton = require('WuiButton');
		var inherit = require('inherit');

		var navTree = new NavTree(null, { parentElement: document.querySelector('body') });

		/**
		 * @class
		 * @classDesc Main view of the game
		 */
		function MainView() {
			WUIView.call(this);
			this.addClassNames('MainView');

			var title, opening;
			var nbOpenings = 0;

			this.once('created', function (options) {
				title = this.createChild('div', { className: 'title' });

				var btnQuest = this.appendChild(new WuiButton('Quest!'));
				var btnCard = this.appendChild(new WuiButton('Card!'));

				btnQuest.on('tap', function () {
					navTree.open('quest');
				});

				btnCard.on('tap', function () {
					navTree.open('card');
				});

				opening = this.createChild('div', { className: 'opening' });

			});

			this.once('opening', function (params) {
				title.setText('Welcome to this amazing demo!');
			});

			this.on('opening', function () {
				nbOpenings += 1;
				opening.setText(nbOpenings);
			});

			this.on('opened', function (params) {
				this.getNavTree().clearHistory();
			});

			this.on('closed', function (params) {
			});
		}

		inherit(MainView, WUIView);

		/**
		 * @class
		 * @classDesc Quest selector
		 */
		function QuestView() {
			WUIView.call(this);
			this.addClassNames('QuestView');

			this.once('opening', function (options) {
				this.createChild('div', { className: 'title', text: 'Quest screen. Exciting!' });

				var btn = this.appendChild(new WuiButton('Back!'));

				btn.on('tap', function () {
					navTree.back();
				});
			});
		}

		inherit(QuestView, WUIView);


		/**
		 * @class
		 * @classDesc Deck management
		 */
		function CardView() {
			WUIView.call(this);
			this.addClassNames('CardView');

			this.once('opening', function (options) {
				this.createChild('div', { className: 'title', text: 'Deck management!' });

				var content = this.createChild('div', { className: 'content' });

				for (var i = 0; i < 10; i += 1) {
					content.createChild('div', { className: 'card', text: i + 1 });
				}

				var btn = this.appendChild(new WuiButton('Back!'));

				btn.on('tap', function () {
					navTree.back();
				});
			});
		}

		inherit(CardView, WUIView);

		navTree.register('main', new MainView());
		navTree.register('quest', new QuestView());
		navTree.register('card', new CardView());
		navTree.open('main');

	}(window));
```