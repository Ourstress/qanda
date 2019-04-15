import React, { useContext, useState, useEffect } from "react";
import "./App.css";

import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";
import Typography from "@material-ui/core/Typography";
import ExpansionPanel from "@material-ui/core/ExpansionPanel";
import ExpansionPanelSummary from "@material-ui/core/ExpansionPanelSummary";
import ExpansionPanelDetails from "@material-ui/core/ExpansionPanelDetails";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import IconButton from "@material-ui/core/IconButton";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";

import { FirebaseContext } from "./utilities/FirebaseContext";

import ReactGA from "react-ga";

export default function App() {
  const Firebase = useContext(FirebaseContext);
  const [siteInfo, setSiteInfo] = useState({ title: "title" });
  const [authStatus, setAuthStatus] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [reply, setReply] = useState("");
  const [user, setUser] = useState({ displayName: "", photoURL: "" });

  useEffect(() => {
    const getDataDoc = (collection, doc, useState) => {
      Firebase.db
        .collection(collection)
        .doc(doc)
        .get()
        .then(function(doc) {
          if (doc.exists) {
            useState(doc.data());
          } else {
            // doc.data() will be undefined in this case
            console.log("No such document!");
          }
        })
        .catch(function(error) {
          console.log("Error getting document:", error);
        });
    };

    const getCollectionDataPushArray = collection => {
      Firebase.db
        .collection(collection)
        .get()
        .then(function(querySnapshot) {
          if (querySnapshot) {
            querySnapshot.forEach(function(doc) {
              // doc.data() is never undefined for query doc snapshots
              const questionData = doc.data();
              // get comments and push into replies array
              if (questionData.Replies) {
                const replies = [];
                Promise.all(
                  questionData.Replies.map(reference =>
                    reference
                      .get()
                      .then(res => {
                        replies.push(res.data());
                      })
                      .catch(err => console.error(err))
                  )
                ).then(res => {
                  const populatedData = {
                    ...questionData,
                    replyData: replies,
                    docID: doc.id
                  };
                  setQuestions([...questions, populatedData]);
                });
              } else {
                // doc.data() will be undefined in this case
                console.log("No such document!");
              }
            });
          }
        })
        .catch(function(error) {
          console.log("Error getting document:", error);
        });
    };

    getDataDoc("Config", "SiteInfo", setSiteInfo);
    getCollectionDataPushArray("Questions");
    checkUserLogin();
    // Google Analytics
    ReactGA.initialize("UA-138345498-1");
    ReactGA.pageview(window.location.pathname + window.location.search);
  }, []);

  const addComment = (reply, questionID) => {
    Firebase.db
      .collection("Replies")
      .add(reply)
      .then(function(doc) {
        Firebase.db
          .collection("Questions")
          .doc(questionID)
          .update({
            Replies: Firebase.firestore.FieldValue.arrayUnion(
              doc //doc.path // `Replies/${doc.id}`
            )
          });
        console.log("Document successfully written!");
      })
      .catch(function(error) {
        console.error("Error writing document: ", error);
      });
  };
  const loginHandler = () =>
    Firebase.auth
      .signInWithPopup(Firebase.googleProvider)
      .then(function(result) {
        // The signed-in user info.
        const user = result.user;
        if (user) {
          setUser({ displayName: user.displayName, photoURL: user.photoURL });
          if (result.additionalUserInfo.isNewUser) {
            Firebase.db
              .collection("Users")
              .add({ name: user.displayName })
              .then(function(doc) {
                console.log("Document successfully written!");
              })
              .catch(function(error) {
                console.error("Error writing document: ", error);
              });
          }
        }
      })
      .catch(function(error) {
        // Handle Errors here.
        console.log(error);
      });

  const checkUserLogin = () => {
    Firebase.auth.onAuthStateChanged(function(user) {
      if (user) {
        setUser({ displayName: user.displayName, photoURL: user.photoURL });
        setAuthStatus(true);
      }
    });
  };
  return (
    <div>
      <AppBar position="static" color="default">
        <Toolbar style={{ justifyContent: "space-between" }}>
          <Typography variant="h6" color="inherit">
            {siteInfo.Title}
          </Typography>
          {authStatus ? (
            <div>
              <Typography variant="subtitle1">
                Hello {user.displayName}
              </Typography>
              <IconButton
                color="inherit"
                onClick={() => {
                  Firebase.auth.signOut();
                  setAuthStatus(false);
                }}
              >
                <Typography>LOG OUT</Typography>
              </IconButton>
            </div>
          ) : (
            <Button
              onClick={() => {
                loginHandler();
                setAuthStatus(true);
              }}
            >
              <Typography>LOGIN</Typography>
            </Button>
          )}
        </Toolbar>
      </AppBar>
      {questions.map((question, i) => {
        return (
          <ExpansionPanel key={question.Title}>
            <ExpansionPanelSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>{question.Title}</Typography>
            </ExpansionPanelSummary>
            <ExpansionPanelDetails style={{ flexDirection: "column" }}>
              <Typography style={{ marginBottom: "3vh" }}>
                {question.Description}
              </Typography>
              {question.replyData.map(comment => {
                return (
                  <Typography
                    style={{ fontStyle: "italic" }}
                    key={comment.Content}
                  >
                    {comment.Content}
                  </Typography>
                );
              })}
              <TextField
                placeholder="Add your comments!"
                margin="normal"
                multiline={true}
                fullWidth
                onChange={e => setReply(e.target.value)}
                value={reply}
              />
              <Button
                onClick={() => {
                  const replies = { Content: reply };
                  const updatedQuestion = {
                    ...question,
                    replyData: [...question.replyData, replies]
                  };
                  const updatedQuestionContainer = questions;
                  updatedQuestionContainer[i] = updatedQuestion;
                  setQuestions(updatedQuestionContainer);
                  setReply("");
                  addComment(replies, question.docID);
                }}
                style={{ width: "10vw", alignSelf: "flex-start" }}
              >
                <Typography>Submit</Typography>
              </Button>
            </ExpansionPanelDetails>
          </ExpansionPanel>
        );
      })}
    </div>
  );
}
