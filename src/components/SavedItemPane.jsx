import { h, Component } from 'preact';
import { log, getHumanDate } from '../utils';
import { trackEvent } from '../analytics';
import { itemService } from '../itemService';
import { alertsService } from '../notifications';
import { deferred } from '../deferred';

export default class SavedItemPane extends Component {
	constructor(props) {
		super(props);
		this.items = [];
		this.state = {
			filteredItems: []
		};
	}
	componentWillUpdate(nextProps) {
		if (this.props.items !== nextProps.items) {
			this.items = Object.values(nextProps.items);
			this.items.sort(function(a, b) {
				return b.updatedOn - a.updatedOn;
			});
			this.setState({
				filteredItems: this.items
			});
		}
	}
	componentDidUpdate(prevProps) {
		if (this.props.isOpen && !prevProps.isOpen) {
			window.searchInput.value = '';
		}
	}
	onCloseIntent() {
		this.props.closeHandler();
	}
	itemClickHandler(item) {
		this.props.itemClickHandler(item);
	}
	itemRemoveBtnClickHandler(item, e) {
		e.stopPropagation();
		this.props.itemRemoveBtnClickHandler(item);
	}
	itemForkBtnClickHandler(item, e) {
		e.stopPropagation();
		this.props.itemForkBtnClickHandler(item);
	}
	keyDownHandler(event) {
		if (!this.props.isOpen) {
			return;
		}

		const isCtrlOrMetaPressed = event.ctrlKey || event.metaKey;
		const isForkKeyPressed = isCtrlOrMetaPressed && event.keyCode === 70;
		const isDownKeyPressed = event.keyCode === 40;
		const isUpKeyPressed = event.keyCode === 38;
		const isEnterKeyPressed = event.keyCode === 13;

		const selectedItemElement = $('.js-saved-item-tile.selected');
		const havePaneItems = $all('.js-saved-item-tile').length !== 0;

		if ((isDownKeyPressed || isUpKeyPressed) && havePaneItems) {
			const method = isDownKeyPressed ? 'nextUntil' : 'previousUntil';

			if (selectedItemElement) {
				selectedItemElement.classList.remove('selected');
				selectedItemElement[method](
					'.js-saved-item-tile:not(.hide)'
				).classList.add('selected');
			} else {
				$('.js-saved-item-tile:not(.hide)').classList.add('selected');
			}
			$('.js-saved-item-tile.selected').scrollIntoView(false);
		}

		if (isEnterKeyPressed && selectedItemElement) {
			const item = this.props.items[selectedItemElement.dataset.itemId];
			console.log('opening', item);
			this.props.itemClickHandler(item);
			trackEvent('ui', 'openItemKeyboardShortcut');
		}

		// Fork shortcut inside saved creations panel with Ctrl/⌘ + F
		if (isForkKeyPressed) {
			event.preventDefault();
			const item = this.props.items[selectedItemElement.dataset.itemId];
			this.props.itemForkBtnClickHandler(item);
			trackEvent('ui', 'forkKeyboardShortcut');
		}
	}

	mergeImportedItems(items) {
		var existingItemIds = [];
		var toMergeItems = {};
		const d = deferred();
		const savedItems = {};
		this.items.forEach(item => (savedItems[item.id] = item));
		items.forEach(item => {
			// We can access `savedItems` here because this gets set when user
			// opens the saved creations panel. And import option is available
			// inside the saved items panel.
			if (savedItems[item.id]) {
				// Item already exists
				existingItemIds.push(item.id);
			} else {
				log('merging', item.id);
				toMergeItems[item.id] = item;
			}
		});
		var mergedItemCount = items.length - existingItemIds.length;
		if (existingItemIds.length) {
			var shouldReplace = confirm(
				existingItemIds.length +
					' creations already exist. Do you want to replace them?'
			);
			if (shouldReplace) {
				log('shouldreplace', shouldReplace);
				items.forEach(item => {
					toMergeItems[item.id] = item;
				});
				mergedItemCount = items.length;
			}
		}
		if (mergedItemCount) {
			itemService.saveItems(toMergeItems).then(() => {
				d.resolve();
				alertsService.add(
					mergedItemCount + ' creations imported successfully.'
				);
				trackEvent('fn', 'itemsImported', mergedItemCount);
			});
		} else {
			d.resolve();
		}
		this.props.closeHandler();

		return d.promise;
	}

	importFileChangeHandler(e) {
		var file = e.target.files[0];

		var reader = new FileReader();
		reader.addEventListener('load', progressEvent => {
			var items;
			try {
				items = JSON.parse(progressEvent.target.result);
				log(items);
				this.mergeImportedItems(items);
			} catch (exception) {
				log(exception);
				alert(
					'Oops! Selected file is corrupted. Please select a file that was generated by clicking the "Export" button.'
				);
			}
		});

		reader.readAsText(file, 'utf-8');
	}

	importBtnClickHandler(e) {
		var input = document.createElement('input');
		input.type = 'file';
		input.style.display = 'none';
		input.accept = 'accept="application/json';
		document.body.appendChild(input);
		input.addEventListener('change', this.importFileChangeHandler.bind(this));
		input.click();
		trackEvent('ui', 'importBtnClicked');
		e.preventDefault();
	}

	searchInputHandler(e) {
		const text = e.target.value;
		if (!text) {
			this.setState({
				filteredItems: this.items
			});
		} else {
			this.setState({
				filteredItems: this.items.filter(
					item => item.title.toLowerCase().indexOf(text) !== -1
				)
			});
		}
		trackEvent('ui', 'searchInputType');
	}

	render() {
		return (
			<div
				id="js-saved-items-pane"
				class={`saved-items-pane ${this.props.isOpen ? 'is-open' : ''}`}
				onKeyDown={this.keyDownHandler.bind(this)}
			>
				<button
					onClick={this.onCloseIntent.bind(this)}
					class="btn  saved-items-pane__close-btn"
					id="js-saved-items-pane-close-btn"
				>
					X
				</button>
				<div class="flex flex-v-center" style="justify-content: space-between;">
					<h3>My Library ({this.items.length})</h3>

					<div class="main-header__btn-wrap">
						<a
							onClick={this.props.exportBtnClickHandler}
							href=""
							class="btn btn-icon hint--bottom-left hint--rounded hint--medium"
							aria-label="Export all your creations into a single importable file."
						>
							Export
						</a>
						<a
							onClick={this.importBtnClickHandler.bind(this)}
							href=""
							class="btn btn-icon hint--bottom-left hint--rounded hint--medium"
							aria-label="Only the file that you export through the 'Export' button can be imported."
						>
							Import
						</a>
					</div>
				</div>
				<input
					id="searchInput"
					class="search-input"
					onInput={this.searchInputHandler.bind(this)}
					placeholder="Search your creations here..."
				/>

				<div id="js-saved-items-wrap" class="saved-items-pane__container">
					{!this.state.filteredItems.length &&
						this.items.length && <div class="mt-1">No match found.</div>}
					{this.state.filteredItems.map(item => (
						<div
							class="js-saved-item-tile saved-item-tile"
							data-item-id={item.id}
							onClick={this.itemClickHandler.bind(this, item)}
						>
							<div class="saved-item-tile__btns">
								<a
									class="js-saved-item-tile__fork-btn  saved-item-tile__btn hint--left hint--medium"
									aria-label="Creates a duplicate of this creation (Ctrl/⌘ + F)"
									onClick={this.itemForkBtnClickHandler.bind(this, item)}
								>
									Fork<span class="show-when-selected">(Ctrl/⌘ + F)</span>
								</a>
								<a
									class="js-saved-item-tile__remove-btn  saved-item-tile__btn hint--left"
									aria-label="Remove"
									onClick={this.itemRemoveBtnClickHandler.bind(this, item)}
								>
									X
								</a>
							</div>
							<h3 class="saved-item-tile__title">{item.title}</h3>
							<span class="saved-item-tile__meta">
								Last updated: {getHumanDate(item.updatedOn)}
							</span>
						</div>
					))}
					{!this.items.length && (
						<h2 class="opacity--30">Nothing saved here.</h2>
					)}
				</div>
			</div>
		);
	}
}
