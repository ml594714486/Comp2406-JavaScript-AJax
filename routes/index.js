var express = require('express');
var router = express.Router();
var ObjectId = require('mongodb').ObjectID;
var mc = require('mongodb').MongoClient;
var db, logsCollection;

var multer  = require('multer')
var storage = multer.memoryStorage()
var upload = multer({ storage: storage })

var multer  = require('multer')
var storage = multer.memoryStorage()
var upload = multer({ storage: storage })

var mc = require('mongodb').MongoClient;
var db, filesCollection, logsCollection;

var moment = require("moment");

// HTML escapting from http://stackoverflow.com/a/13510502

var __entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': '&quot;',
    "'": '&#39;',
    "/": '&#x2F;'
};

String.prototype.escapeHTML = function() {
    return String(this).replace(/[&<>"'\/]/g, function (s) {
        return __entityMap[s];
    });
}

router.get('/', function(req, res) {
    res.render('index', {title: 'COMP 2406 Log Analysis & Visualization',
                         numFiles: 4,
                         numEntries: 30000});
});


function logOrder(a, b) {
    var countOrder;
    var fileOrder;
    var dateOrder;

    var ma = moment([a.month, a.day, a.time].join(' '), "MMM-DD-HH:mm:ss");
    var mb = moment([b.month, b.day, b.time].join(' '), "MMM-DD-HH:mm:ss");

    if (ma.isSame(mb)) {
        dateOrder = 0;
    } else if (ma.isBefore(mb)) {
        dateOrder = -1;
    } else {
        dateOrder = 1;
    }
    
    if (a.count > b.count) {
        countOrder = 1;
    } else if (a.count < b.count) {
        countOrder = -1;
    } else {
        countOrder = 0;
    }

    if (a.file > b.file) {
        fileOrder = 1;
    } else if (a.file < b.file) {
        fileOrder = -1;
    } else {
        fileOrder = 0;
    }

    if (dateOrder === 0) {
        if (fileOrder === 0) {
            return countOrder;
        } else {
            return fileOrder;
        }
    } else {
        return dateOrder;
    }
}

function entriesToLines(theLogs, htmlify) {
    var i, s, entry;
    var lines = [];

    var entries = theLogs.sort(logOrder);

    for (i=0; i<theLogs.length; i++) {
        entry = theLogs[i];
        s = [entry.month, entry.day, entry.time, entry.host,
             entry.service + ":", entry.message];
	if (htmlify) {
            lines.push('<p class="scrollpar">' +
		       s.join(' ').escapeHTML() + '</p>');
	} else {
            lines.push(s.join(' '));
	}
    }

    return lines;
}

function analyzeSelected(theLogs) {
    var dateCount = {};
    var labels;
    var data = [];
    
    var graphData = {
        labels: [],
        datasets: [
            {
                label: "Feb 16",
                fillColor: "rgba(151,187,205,0.5)",
                strokeColor: "rgba(151,187,205,0.8)",
                highlightFill: "rgba(151,187,205,0.75)",
                highlightStroke: "rgba(151,187,205,1)",
                data: []
            }
        ]
    };

    theLogs.forEach(function(entry) {
	var theDate = entry.month + ' ' + entry.day;

	if (dateCount[theDate]) {
	    dateCount[theDate]++;
	} else {
	    dateCount[theDate] = 1;
	}
    });

    labels = Object.keys(dateCount).sort();

    labels.forEach(function(d) {
	data.push(dateCount[d]);
    });
    
    graphData.labels = labels;
    graphData.datasets[0].data = data;
    
    return "var data = " + JSON.stringify(graphData);
}


function doQuery(req, res) {
    var queryType = req.body.queryType;
    
    var file = new RegExp(req.body.file);
    var message = new RegExp(req.body.message);
    var service = new RegExp(req.body.service);
    var month = new RegExp(req.body.month);
    var day = new RegExp(req.body.day);
    
    logsCollection.find({file: file, message: message, service: service, month: month, day: day}).toArray(function(err, data){
		res.send(data);
	});
}
router.post('/doQuery', doQuery);


router.get('/testVis', function(req, res) {
    res.render('visualize', {title: "Query Visualization Test",
                             theData: analyzeSelected()});
});

var connectCallback = function(err, returnedDB) {
    if (err) {
        throw err;
    }

    db = returnedDB;
    
    filesCollection = db.collection('files');
    logsCollection = db.collection('logs');
}

mc.connect('mongodb://localhost/log-demo', connectCallback);


router.get('/getFileStats', function(req, res) {
    function returnStats(err, stats) {
        if (err) {
            sendStatus(500);
        } else {
            res.send(stats);
        }
    }
    
    filesCollection.find({},{content: 0})
            .toArray(returnStats);
});


router.post("/uploadText", upload.single('theFile'), function(req, res) {
    var theFile = req.file;
    var storedFile;
    var lines;
    var entries = [];
    var i, j, entry, field;

    function returnResult(err, result) {
        if (err) {
            res.sendStatus(500);
        } else {
            res.send("Upload succeeded: " + storedFile.name + "\n");
        }
    }
   
    if (theFile) {
        storedFile = {
            name: theFile.originalname,
            size: theFile.size,
            content: theFile.buffer.toString('utf8')
        };
        
        lines = theFile.buffer.toString('utf8').split('\n');

        for (i=0; i<lines.length; i++) {
            if (lines[i] && lines[i] !== '') {
                field = lines[i].split(' ');
                entry = {};
                j = 0;
                while (j < field.length) {
                    if (field[j] === "") {
                        field.splice(j, 1);
                    } else {
                        j++;
                    } 
                }
                entry.month = field[0];
                entry.day = field[1];
                entry.time = field[2];
                entry.host = field[3];
                entry.service = field[4].slice(0,-1);
                entry.message = field.slice(5).join(' ');
                entry.file = theFile.originalname;
                entry.count = i;
                entries.push(entry);
            }
        }
        
        //console.log(entries);
        logsCollection.insert(entries, function(err, data){
			if(err)
			{
				throw err;
			}
			else
			{
				console.log("insert succeeded");
			}
			
		});
        filesCollection.update({name: theFile.originalname},
                               storedFile,
                               {upsert: true},
                               returnResult);
    } else {
        res.sendStatus(403);
    }
});

router.post("/downloadFile", function (req, res) {
    var name = req.body.downloadFile;

    function returnFile(err, theFile) {
        if (err) {
            res.send("File not found");
        } else {
            res.type('text/plain');
            res.send(theFile.content);
        }
    }

    filesCollection.findOne({name: name},returnFile);    
});

module.exports = router;
