
$(document).ready(function(){

	/* share */
	$('.share-pop').click(function(evt){
		evt.preventDefault();
		window.open($(this).attr('href'), "share", "width=500,height=300,status=no,scrollbars=no,resizable=no,menubar=no,toolbar=no");
		return false;
	});

	/* hide address bar on mobile devices */
	/Mobile/.test(navigator.userAgent) && !location.hash && setTimeout(function(){
		if (!pageYOffset) window.scrollTo(0, 1);
	},1000);
	
	/* add class for responive design on embedded use */
	if (window != window.top) {
		$('body').addClass('in-frame');
	} else {
		$('body').addClass('not-in-frame');
	}
	
	/* post actions */
	$('#button-post').click(function(){
		$('body').addClass('show-post');
	});
	$('#post-close').click(function(){
		$('body').removeClass('show-post');
	});
	$('#post-form').submit(function(evt){
		evt.preventDefault();
		$.post({
			url: "api/post.json",
			cache: false,
			data: {
				slogan: $('#slogan').val()
			},
			dataType: "json",
			success: function(data){
				if (data.error) {
					$('#message').text(data.error);
				} else {
					$('#slogan').val('');
					$('body').removeClass('show-post');
				}
			}
		});
	});
	
	/* update stuff */
	var update = function(){
		$.ajax("api/data.json", {
			cache: false,
			dataType: "json",
			success: function(data){
				$('#protesters-slogan-1').text(data.slogans[0]);
				$('#protesters-slogan-2').text(data.slogans[1]);
				$('#protesters-slogan-3').text(data.slogans[2]);
				$('#protesters-slogan-4').text(data.slogans[3]);
				$('#show-protesters-total').text(data.count.protesters_total.toString());
				$('#show-protesters').text(data.count.protesters.toString());
			}
		});
	};
	update();
	setInterval(function(){
		update();
	},15000);
	
});

