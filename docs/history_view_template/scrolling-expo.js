/* scrolling behaviour */

const textContainer = document.querySelector('.text-container');
const messages = textContainer.querySelectorAll('.message');
const scrollCounter = document.getElementById('scroll_counter'); // for debugging only

const scrollStep = 200; // small scrolling step
const scrollBigStep = 500;

const messageGap = parseInt(getComputedStyle(messages[0]).marginTop) - 1; // gap between the message and the edge of the container
//const messageGap = 10;

let currentMessageIndex = 0; // active message tracker
let isManualNavigation = false; // flag to prevent scroll event interference

// function to update currentMessageIndex based on viewport visibility
function updateCurrentMessageIndex() {
    // skip update if manual navigation is in progress
    if (isManualNavigation) return;

    const scrollTop = textContainer.scrollTop;
    const containerHeight = textContainer.clientHeight;
    const scrollBottom = scrollTop + containerHeight;
    const maxScroll = textContainer.scrollHeight - textContainer.clientHeight;

    const currentMessage = messages[currentMessageIndex];
    const messageTop = currentMessage.offsetTop;
    const messageBottom = messageTop + currentMessage.offsetHeight;

    // if scroll reaches the end, activate last message
    if (scrollTop >= maxScroll - 1) {
        currentMessageIndex = messages.length - 1;
    }
    // if current message scrolled above the top (out of view at top)
    else if (messageBottom < scrollTop && currentMessageIndex < messages.length -1) {
        currentMessageIndex++;
    }
    // if current message scrolled below the bottom (out of view at bottom)
    else if (messageTop > scrollBottom && currentMessageIndex > 0) {
        currentMessageIndex--;
    }
    updateActiveMessageStyle(); // update the style of the active message
}

// update current message style
function updateActiveMessageStyle() {
    // remove active class from all messages
    messages.forEach(msg => msg.classList.remove('active'));
    // add active class to current message
    messages[currentMessageIndex].classList.add('active');
}

updateActiveMessageStyle(); // initial style update

// updating the current active message on scrolling:
textContainer.addEventListener('scroll',() => {
    updateCurrentMessageIndex(); // update on every scroll

    // this is just for debugging
    scrollCounter.innerHTML = 'scrollTop: ' + textContainer.scrollTop + 
    ' <br> current message: ' + currentMessageIndex + 
    ' <br> current message offset top: ' + messages[currentMessageIndex].offsetTop +
    ' <br> current message height: ' + messages[currentMessageIndex].offsetHeight +
    ' <br> current message bottom: ' + (messages[currentMessageIndex].offsetTop + messages[currentMessageIndex].offsetHeight) + 
    ' <br> container scroll height: ' + textContainer.scrollHeight + 
    ' <br> container height: ' + textContainer.clientHeight + 
    ' <br> max scroll: ' + (textContainer.scrollHeight - textContainer.clientHeight);
}); 

// scrolling on key presses:
document.addEventListener('keydown', (event) => {
    if (event.key == 'j') {
        textContainer.scrollBy(0, scrollStep); // scroll down
    } else if (event.key == 'k') {
        textContainer.scrollBy(0, - scrollStep); //scroll up
    } else if (event.key == 'J') {
        textContainer.scrollBy(0, scrollBigStep); //scroll down
    } else if (event.key == 'K') {
        textContainer.scrollBy(0, - scrollBigStep); //scroll up
    } else if (event.key == 'g') {
        textContainer.scrollTo(0, 0); //scroll to top
    } else if (event.key == 'G') {
        textContainer.scrollTo(0, textContainer.scrollHeight - textContainer.clientHeight); //scroll to bottom
    } else if (event.key == 'd') {
        // scroll down to next message
        if (currentMessageIndex < messages.length -1) {
            isManualNavigation = true;
            currentMessageIndex++;
            const messageTop = messages[currentMessageIndex].offsetTop;
            textContainer.scrollTo({
                top: messageTop - messageGap,
                behavior: 'smooth' 
            });
            updateActiveMessageStyle();
            setTimeout(() => {isManualNavigation = false;}, 500);
        }
    } else if (event.key == 'u') {
        // scroll up to the next message
        if (currentMessageIndex > 0) {
            isManualNavigation = true;
            currentMessageIndex--;
            const messageTop = messages[currentMessageIndex].offsetTop;
            textContainer.scrollTo({
                top: messageTop - messageGap,
                behavior: 'smooth'
            
            });
            updateActiveMessageStyle();
            setTimeout(() => {isManualNavigation = false;}, 500);
        }
    }
});




