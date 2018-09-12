$(function(){
// Minimized function I made which helps sending form POST data easily
function SendToServer(u,f,c){$.ajax({url:u,type:"POST",data:f,contentType:false,processData:false}).done(function(d){c(d)})}

$("#btnAddRow").click(function(){
  AddRow();
});

$("#btnSubmit").click(function(){
  $("tr").slice(1).each(function(){
    var self     = this;
    var formData = new FormData();
    var name     = $(".summoner-name",   this).val();
    var region   = $(".summoner-region", this).val();
    var file     = $(".summoner-avatar", this).get(0).files[0];

    // Skip this row if it's disabled, already uploading, or has no file
    var isDisabled  = $(this).attr("status") == "uploaded";
    var isUploading = $(this).attr("status") == "uploading";
    var noFile      = (typeof file === "undefined");
    if(isDisabled || isUploading || noFile)
      return true;

    $(".summoner-loading", self).css("background", "url(spin.svg)");
    $(".summoner-loading", self).text("");

    formData.append("name", name);
    formData.append("region", region);
    formData.append("file", file, file.name);

    $(self).attr("status", "uploading");
    SendToServer("uploadavatar", formData, function(data){
      console.log("<==================");
      $(".summoner-loading").css("background", "url()");
      console.log(data);
      if(data){
        $(self).attr("status", "uploaded");
        $(".summoner-name",    self).prop("disabled", true);
        $(".summoner-region",  self).prop("disabled", true);
        $(".summoner-avatar",  self).prop("disabled", true);
        $("[data=active]",     self).attr("data", "disabled");
        $(".summoner-loading", self).css("color", "green");
        $(".summoner-loading", self).text("✔");
      }else{
        $(self).attr("status", "");
        $(".summoner-loading", self).css("color", "red");
        $(".summoner-loading", self).text("✘");
      }
    });
  });
});

function AddRow(){
  AddRow.row = ++AddRow.row || 0;
  var row = AddRow.row;

  $("#summoner-table tbody").append(`
  <tr>
    <td>
      <input class="summoner-name" type="text">
    </td>
    <td>
      <select class="summoner-region">
        <option value="NA">NA</option>
        <option value="OCE">OCE</option>
        <option value="EUW">EUW</option>
        <option value="EUNE">EUNE</option>
      </select>
    </td>
    <td>
      <label for="av${row}" data="active" type="file">Select avatar</label>
      <input  id="av${row}" type="file" class="summoner-avatar">
    </td>
    <td>
      <img id="ico${row}" class="summoner-icon" draggable="false"></img>
    </td>
    <td>
      <span id="load${row}" class="summoner-loading" draggable="false"></img>
    </td>
  </tr>`);

  $(`#av${row}`).change(function(){
    if(this.files && this.files[0]){ // If the user has selected a file
      var reader = new FileReader(); // Create a FileReader object
      reader.onload = function(e){   // When a file has been loaded...
        $(`#ico${row}`).attr("src", e.target.result); // ...preview image file
        $(`#load${row}`).text("");                    // ...remove any text
      }
      reader.readAsDataURL(this.files[0]); // Read a file as base64 data
    }
    else{
      $(`#ico${row}`).attr("src", "");
    }
  });
}

AddRow();
});
