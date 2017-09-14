$(function() {
    var fileList = $("#fileList");

    var stats;
    
    var queryType = $("#queryType");
    
	var m = $("#message");
	var s = $("#service");
	var f = $("#file");
	var month = $("#month");
	var d = $("#day");

	var box = $("#box");
	
	var submitQuery = $("#submitQuery");
	
	submitQuery.click(function(){
		
		var userInput = {message: m.val(), 
						service: s.val(), 
						file: f.val(), 
						month: month.val(), 
						day: d.val()};
		console.log(userInput);				
						
		if(queryType.val() == "show")
		{
			console.log("in show");
			$.post("/doQuery", userInput, show);
		}
		
	});
	
	
	function show(data)
	{
		box.text(convert(data));
	}
	
	function convert(data)
	{
		var output = "";
		
		for(var i = 0; i < data.length; i++)
		{
			output += data[i].month + " " + data[i].day + " " + data[i].time + " " + data[i].host + " " + data[i].service + " "
			+ data[i].message + "\n";
		}
		
		return output;
	}
    function downloadFile(i) {
        function saveDownloadedFile(fileContents) {
            console.log("Trying to save file");
            console.log(fileContents);
            saveAs(new Blob([fileContents],
                            {type: "text/plain;charset=utf-8"}),
                   stats[i].name);
        }
        
        return function() {
            $.post("/downloadFile", {downloadFile: stats[i].name},
                   saveDownloadedFile);
        }
    }
    
    function doUpdateFileList (returnedStats) {
        var i;
        stats = returnedStats;
        fileList.empty();
        for (i=0; i<stats.length; i++) {
            fileList.append('<li> <a id="file' + i + '" href="#">' +
                            stats[i].name +
                            "</a> (" + stats[i].size + " bytes)");
            $("#file" + i).click(downloadFile(i));
        }
    }
    
    function updateFileList () {
		console.log("hh");
        $.getJSON("/getFileStats", doUpdateFileList);
    }

    updateFileList();
    
    $("#fileuploader").uploadFile({
        url:"/uploadText",
        fileName:"theFile",
        dragDrop: false,
        uploadStr: "Upload Files",
        afterUploadAll: updateFileList
    });    
});
